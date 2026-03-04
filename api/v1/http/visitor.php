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
    setcookie('visitor_id', $visitor, [
        'expires' => time() + 31536000,
        'path' => '/',
        'samesite' => 'Lax',
    ]);

    return $visitor;
}
