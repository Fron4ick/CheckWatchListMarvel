#!/usr/bin/env bash
# Создание таблиц YDB Document API для Marvel Timeline Board.
#
# Требования:
#   * установленный AWS CLI (aws);
#   * статический access key сервисного аккаунта (создаётся в IAM Yandex Cloud):
#       aws configure
#         AWS Access Key ID:     <key_id>
#         AWS Secret Access Key: <secret>
#         Default region name:   ru-central1
#         Default output format: json
#
# ВАЖНО: схема таблиц соответствует backend/src/store.js (YdbStore).
# Каждая таблица хранит объект JSON целиком в атрибуте `data`,
# ключ — единственный HASH-атрибут типа S.
# Не меняйте ключевые атрибуты без правки кода бэкенда.

# Endpoint базы YDB Document API:
ENDPOINT="https://docapi.serverless.yandexcloud.net/ru-central1/b1gp8ldqrevcvu23e82l/etneo5gfc9hj4v2p3rga"

set -e

echo "==> marvel_users (HASH id)"
aws dynamodb create-table \
  --endpoint-url "$ENDPOINT" \
  --table-name marvel_users \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

echo "==> marvel_users_by_email (HASH email)"
aws dynamodb create-table \
  --endpoint-url "$ENDPOINT" \
  --table-name marvel_users_by_email \
  --attribute-definitions AttributeName=email,AttributeType=S \
  --key-schema AttributeName=email,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

echo "==> marvel_users_by_provider (HASH providerId)"
aws dynamodb create-table \
  --endpoint-url "$ENDPOINT" \
  --table-name marvel_users_by_provider \
  --attribute-definitions AttributeName=providerId,AttributeType=S \
  --key-schema AttributeName=providerId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

echo "==> marvel_sessions (HASH token)"
aws dynamodb create-table \
  --endpoint-url "$ENDPOINT" \
  --table-name marvel_sessions \
  --attribute-definitions AttributeName=token,AttributeType=S \
  --key-schema AttributeName=token,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

echo "==> marvel_codes (HASH email)"
aws dynamodb create-table \
  --endpoint-url "$ENDPOINT" \
  --table-name marvel_codes \
  --attribute-definitions AttributeName=email,AttributeType=S \
  --key-schema AttributeName=email,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

echo "==> marvel_watched (HASH userId)"
aws dynamodb create-table \
  --endpoint-url "$ENDPOINT" \
  --table-name marvel_watched \
  --attribute-definitions AttributeName=userId,AttributeType=S \
  --key-schema AttributeName=userId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

echo "==> Готово. Проверка:"
aws dynamodb list-tables --endpoint-url "$ENDPOINT"