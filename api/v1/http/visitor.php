<?php
declare(strict_types=1);

// visitor_id is always a 32-char hex string (bin2hex(random_bytes(16))).
// Reject anything that doesn't match to prevent SQL truncation errors
// if a client sends a stale or malformed value.
function is_valid_visitor_id(string $id): bool
{
    return strlen($id) === 32 && ctype_xdigit($id);
}

function get_visitor_id(?array $payload = null): string
{
    $cookieVisitor = (string) ($_COOKIE['visitor_id'] ?? '');
    if ($cookieVisitor !== '' && is_valid_visitor_id($cookieVisitor)) {
        return $cookieVisitor;
    }

    if ($payload !== null && isset($payload['visitor_id']) && is_string($payload['visitor_id'])) {
        $payloadVisitor = $payload['visitor_id'];
        if ($payloadVisitor !== '' && is_valid_visitor_id($payloadVisitor)) {
            return $payloadVisitor;
        }
    }

    $headerVisitor = (string) ($_SERVER['HTTP_X_VISITOR_ID'] ?? '');
    if ($headerVisitor !== '' && is_valid_visitor_id($headerVisitor)) {
        return $headerVisitor;
    }

    return '';
}

function ensure_visitor_id(?array $payload = null): string
{
    $visitor = get_visitor_id($payload);
    if ($visitor !== '') {
        return $visitor;
    }

    $visitor = bin2hex(random_bytes(16));
    set_visitor_cookie($visitor);

    return $visitor;
}

function set_visitor_cookie(string $visitorId): void
{
    setcookie('visitor_id', $visitorId, [
        'expires' => time() + 31536000,
        'path' => '/',
        'samesite' => 'Lax',
        'httponly' => true,
        'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
    ]);
}

function get_client_ip(): ?string
{
    $raw = (string) ($_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '');
    if ($raw === '') {
        return null;
    }

    $parts = array_map('trim', explode(',', $raw));
    foreach ($parts as $candidate) {
        if (filter_var($candidate, FILTER_VALIDATE_IP) !== false) {
            return $candidate;
        }
    }

    return null;
}
