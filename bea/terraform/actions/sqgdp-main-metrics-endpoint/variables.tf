variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-2"
}

variable "bucket" {
  description = "S3 bucket holding the silver Iceberg data, Athena query results, and the gold endpoint output. Must already exist -- this stack does not create it."
  type        = string
  default     = "ecolooker-bea"
}

variable "silver_prefix" {
  description = "Prefix under bucket where the Iceberg table's data/metadata live (read access needed for Athena to scan it)."
  type        = string
  default     = "silver/sqgdp/"
}

variable "athena_output_prefix" {
  description = "Prefix under bucket that Athena writes query results/staging output to."
  type        = string
  default     = "athena-results/sqgdp-main-metrics/"
}

variable "gold_prefix" {
  description = "Prefix under bucket that the endpoint's JSON payload is written to."
  type        = string
  default     = "gold/endpoints/sqgdp-main-metrics/"
}

variable "results_key" {
  description = "Full S3 key (within bucket) the Lambda writes its gzipped JSON payload to."
  type        = string
  default     = "gold/endpoints/sqgdp-main-metrics/datasets.json.gz"
}

variable "athena_database" {
  description = "Glue Data Catalog database the SQGDP views live in (see bea/athena/sqgdp_views.sql)."
  type        = string
  default     = "bea"
}

variable "athena_workgroup" {
  description = "Athena workgroup to run queries under. Must already exist."
  type        = string
  default     = "primary"
}

variable "lambda_function_name" {
  description = "Name of the Lambda function."
  type        = string
  default     = "sqgdp-main-metrics-endpoint"
}

variable "lambda_runtime" {
  description = "Lambda Python runtime."
  type        = string
  default     = "python3.13"
}

variable "lambda_timeout" {
  description = "Lambda timeout, in seconds. Must comfortably exceed QUERY_TIMEOUT_SECONDS (default 20s) x number of Athena query retries."
  type        = number
  default     = 60
}

variable "lambda_memory_size" {
  description = "Lambda memory, in MB."
  type        = number
  default     = 256
}

variable "allowed_origin" {
  description = "Value for the Access-Control-Allow-Origin header the Lambda returns."
  type        = string
  default     = "*"
}
