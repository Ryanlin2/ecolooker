data "aws_s3_bucket" "data" {
  bucket = var.bucket
}

data "archive_file" "lambda" {
  type        = "zip"
  source_file = "${path.module}/../../../lambda/sqgdp_main_metrics_reader.py"
  output_path = "${path.module}/lambda_function.zip"
}

resource "aws_iam_role" "lambda_role" {
  name = "lambda-sqgdp-main-metrics-reader-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Principal = {
          Service = "lambda.amazonaws.com"
        }

        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_sqgdp_main_metrics_reader" {
  name = "lambda-sqgdp-main-metrics-reader-policy"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Sid    = "ReadGoldEndpoint"
        Effect = "Allow"

        Action = [
          "s3:GetObject"
        ]

        Resource = "${data.aws_s3_bucket.data.arn}/${var.results_key}"
      }
    ]
  })
}

resource "aws_lambda_function" "sqgdp_main_metrics_reader" {
  function_name = var.lambda_function_name

  filename         = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256

  role = aws_iam_role.lambda_role.arn

  handler = "sqgdp_main_metrics_reader.lambda_handler"
  runtime = var.lambda_runtime

  timeout     = var.lambda_timeout
  memory_size = var.lambda_memory_size

  environment {
    variables = {
      RESULTS_BUCKET = var.bucket
      RESULTS_KEY    = var.results_key
      ALLOWED_ORIGIN = var.allowed_origin
      CACHE_CONTROL  = var.cache_control
    }
  }

  depends_on = [
    aws_iam_role_policy.lambda_sqgdp_main_metrics_reader,
    aws_iam_role_policy_attachment.lambda_logs
  ]
}

resource "aws_lambda_function_url" "sqgdp_main_metrics_reader" {
  function_name      = aws_lambda_function.sqgdp_main_metrics_reader.function_name
  authorization_type = "NONE"
}
