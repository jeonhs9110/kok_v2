# ─────────────────────────────────────────────────────────────────────
# AWS SES (Simple Email Service) — outbound email infrastructure.
#
# Why this exists: Cognito's default sender is
#   no-reply@verificationemail.com
# which has no relationship to kokkokgarden.com and no DKIM signing,
# so every verification email lands in Gmail/Outlook spam. A real
# customer who clicks "register" doesn't see the code, retries,
# eventually gives up. Test registrations also confirmed this.
#
# Fix: own the sender identity. Send through SES from
# noreply@kokkokgarden.com with DKIM, SPF, and DMARC alignment.
# Cognito gets pointed at this SES identity in cognito.tf.
#
# Phased rollout (two terraform applies):
#
#   Phase 1 (this commit):
#     - Create the SES domain identity
#     - Generate the 3 DKIM tokens
#     - Output the DNS records the operator must add at Vercel
#       (CNAME × 3 for DKIM, TXT for SPF, TXT for DMARC)
#     - DNS propagation + SES verification takes ~5-30 minutes
#       after the records are visible
#
#   Phase 2 (follow-up commit, gated on SES verification):
#     - Flip aws_cognito_user_pool.main.email_configuration to
#       email_sending_account = "DEVELOPER" + source_arn = ses arn
#     - Add a KOKKOK-branded verification message template
#     - (Optional) File the SES production access request via
#       AWS support — the sandbox limits sending to verified
#       recipients only, so without production access only emails
#       to addresses YOU verified in SES go through.
#
# Cost: SES domain identity is free. DKIM is free. The first 62k
# emails/month sent from an EC2 instance are free; beyond that
# it's $0.10 / 1000 emails. Customer signup volume is well inside
# the free tier; no impact on the $70/mo budget cap.
# ─────────────────────────────────────────────────────────────────────

# The sending domain — same as the public site so DMARC alignment is
# straightforward and customers recognize the From address.
resource "aws_ses_domain_identity" "kokkokgarden" {
  domain = var.domain_name # "kokkokgarden.com"
}

# DKIM signing — Amazon generates 3 selectors, each one needs a CNAME
# record at the operator's DNS provider. After all 3 resolve, SES
# auto-flips DKIM "Verified" status (visible in the console under
# Configuration → Verified identities → kokkokgarden.com).
resource "aws_ses_domain_dkim" "kokkokgarden" {
  domain = aws_ses_domain_identity.kokkokgarden.domain
}

# Mail-from subdomain. Using "mail.kokkokgarden.com" as the bounce-
# return path means bounce/complaint NDRs don't pollute the apex
# domain's reputation and SPF alignment is explicit. AWS recommends
# this for any sender doing >1k emails/month; we may not hit that
# right away but it's cheap insurance.
resource "aws_ses_domain_mail_from" "kokkokgarden" {
  domain           = aws_ses_domain_identity.kokkokgarden.domain
  mail_from_domain = "mail.${aws_ses_domain_identity.kokkokgarden.domain}"

  # Cognito stops sending if SES can't read the bounce mailbox. With
  # this set to UseDefaultValue, SES falls back to using its own
  # bounce path when the operator's MX isn't configured yet, so
  # apply doesn't hard-fail on day 1.
  behavior_on_mx_failure = "UseDefaultValue"
}
