<?php
declare(strict_types=1);

// Shared security headers for all API responses.
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Cache-Control: no-store, no-cache, must-revalidate');
header("Content-Security-Policy: frame-ancestors 'none'");

function json_success(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function json_error(string $message, int $status, array $extra = []): void
{
    http_response_code($status);
    echo json_encode(
        array_merge(['error' => true, 'message' => $message], $extra),
        JSON_UNESCAPED_UNICODE
    );
    exit;
}
