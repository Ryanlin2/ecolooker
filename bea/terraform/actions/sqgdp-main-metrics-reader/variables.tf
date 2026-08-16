variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-2"
}

variable "bucket" {
  description = "S3 bucket the gold endpoint payload lives in. Must already exist -- this stack does not create it."
  type        = string
  default     = "ecolooker-bea"
}

variable "results_key" {
  description = "S3 key (within bucket) that sqgdp-main-metrics-endpoint writes its gzipped JSON payload to, and this function reads from."
  type        = string
  default     = "gold/endpoints/sqgdp-main-metrics/datasets.json.gz"
}

variable "lambda_function_name" {
  description = "Name of the Lambda function."
  type        = string
  default     = "sqgdp-main-metrics-reader"
}

variable "lambda_runtime" {
  description = "Lambda Python runtime."
  type        = string
  default     = "python3.13"
}

variable "lambda_timeout" {
  description = "Lambda timeout, in seconds."
  type        = number
  default     = 10
}

variable "lambda_memory_size" {
  description = "Lambda memory, in MB."
  type        = number
  default     = 128
}

variable "allowed_origin" {
  description = "Value for the Access-Control-Allow-Origin header the Lambda returns."
  type        = string
  default     = "*"
}

variable "cache_control" {
  description = "Value for the Cache-Control header the Lambda returns."
  type        = string
  default     = "public, max-age=300"
}
