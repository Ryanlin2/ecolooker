output "lambda_url" {
  description = "Public Function URL that triggers a refresh and returns write metadata"
  value       = aws_lambda_function_url.sqgdp_main_metrics.function_url
}

output "lambda_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.sqgdp_main_metrics.function_name
}

output "lambda_role_arn" {
  description = "IAM role ARN the Lambda runs as"
  value       = aws_iam_role.lambda_role.arn
}

output "gold_endpoint_s3_uri" {
  description = "S3 location of the gzipped JSON payload the website reads"
  value       = "s3://${var.bucket}/${var.results_key}"
}
