output "lambda_url" {
  description = "Public URL for the Lambda function"
  value       = aws_lambda_function_url.request_handler.function_url
}

output "bucket_name" {
  description = "S3 bucket receiving Lambda results"
  value       = aws_s3_bucket.results.id
}

output "lambda_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.request_handler.function_name
}