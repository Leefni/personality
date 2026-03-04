<?php
declare(strict_types=1);

function require_method(string $method): void
{
    if (strtoupper($_SERVER['REQUEST_METHOD'] ?? '') !== strtoupper($method)) {
        json_error('Method not allowed', 405);
    }
}

function get_json_payload(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        json_error('Invalid JSON payload', 400);
    }

    return $decoded;
}
