<?php
declare(strict_types=1);

function get_visitor_id(?array $payload = null): string
{
    $cookieVisitor = (string) ($_COOKIE['visitor_id'] ?? '');
    if ($cookieVisitor !== '') {
        return $cookieVisitor;
    }

    if ($payload !== null && isset($payload['visitor_id']) && is_string($payload['visitor_id']) && $payload['visitor_id'] !== '') {
        return $payload['visitor_id'];
    }

    if (isset($_SERVER['HTTP_X_VISITOR_ID']) && $_SERVER['HTTP_X_VISITOR_ID'] !== '') {
        return (string) $_SERVER['HTTP_X_VISITOR_ID'];
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
