variable "region" {
  description = "Primary AWS region"
  type        = string
  default     = "ap-northeast-2"
}

variable "aws_profile" {
  description = "Local AWS CLI profile to use"
  type        = string
  default     = "kokkokgarden"
}

variable "environment" {
  description = "Environment name (prod / staging)"
  type        = string
  default     = "prod"
}

variable "project_name" {
  description = "Short project tag used in resource names"
  type        = string
  default     = "kokkok"
}

variable "domain_name" {
  description = "Public domain. Leave empty until Route 53 / ACM is wired."
  type        = string
  default     = ""
}

# ---- RDS ----
variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "db_allocated_storage_gb" {
  type    = number
  default = 20
}

variable "db_max_allocated_storage_gb" {
  type    = number
  default = 100
}

variable "db_name" {
  type    = string
  default = "kokkokgarden"
}

variable "db_username" {
  type    = string
  default = "kokkok_app"
}

# ---- EC2 ----
variable "ec2_instance_type" {
  type    = string
  default = "t4g.small"
}

variable "ec2_ami_owner" {
  description = "Amazon Linux 2023 arm64 latest AMI lookup owner"
  type        = string
  default     = "amazon"
}
