# s3.tf used to define an `aws_s3_bucket.storage` for "product images,
# hero banners, shorts thumbnails etc." Pre-dated the s3-media.tf
# design that ships today (kokkok-media bucket fronted by CloudFront
# /media/*). The legacy bucket was orphaned — no consumer, no policy,
# no CloudFront origin pointing at it, no code referencing it.
#
# Removed 2026-06-30 as part of the handoff cleanup. Bucket was empty
# (verified via `aws s3 ls`). force_destroy=false on the old resource
# means terraform refuses to delete it directly — flow was:
#   1. Empty bucket: aws s3 rm s3://kokkok-storage-<hex> --recursive
#   2. terraform state rm aws_s3_bucket.storage (+ its 4 sub-resources)
#   3. aws s3api delete-bucket --bucket kokkok-storage-<hex>
#
# The kokkok-media bucket (s3-media.tf) is the live media store.
