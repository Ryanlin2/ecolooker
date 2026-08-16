output "lambda_url" {
  description = "Public Function URL clients read the metrics payload from"
  value       = aws_lambda_function_url.sqgdp_main_metrics_reader.function_url
}

output "lambda_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.sqgdp_main_metrics_reader.function_name
}

output "lambda_role_arn" {
  description = "IAM role ARN the Lambda runs as"
  value       = aws_iam_role.lambda_role.arn
}
