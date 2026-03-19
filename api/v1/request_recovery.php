<?php
declare(strict_types=1);

require __DIR__ . '/common.php';

require_method('POST');

$payload = get_json_payload();
$email = isset($payload['email']) && is_string($payload['email']) ? trim($payload['email']) : '';
if ($email === '' || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
    json_error('Invalid email', 422);
}

$visitorId = ensure_visitor_id();
$ipAddress = get_client_ip();

$windowSeconds = max(60, (int) ($config['recovery_rate_limit_window_seconds'] ?? 3600));
$maxPerVisitor = max(1, (int) ($config['recovery_rate_limit_max_per_visitor'] ?? 3));
$maxPerEmail = max(1, (int) ($config['recovery_rate_limit_max_per_email'] ?? 5));
$windowStart = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->sub(new DateInterval('PT' . $windowSeconds . 'S'));

$visitorCount = $quizRepository->countRecoveryRequestsForVisitorSince($visitorId, $windowStart);
$emailCount = $quizRepository->countRecoveryRequestsForEmailSince($email, $windowStart);

if ($visitorCount >= $maxPerVisitor || $emailCount >= $maxPerEmail) {
    $quizRepository->writeRecoveryAudit('recovery_request', 'rate_limited', $visitorId, $email, $ipAddress, [
        'visitor_attempts' => $visitorCount,
        'email_attempts' => $emailCount,
    ]);

    json_error('Too many recovery requests. Please try again later.', 429);
}

$rawToken = bin2hex(random_bytes(32));
$tokenHash = hash('sha256', $rawToken);
$ttlSeconds = max(60, (int) ($config['recovery_token_ttl_seconds'] ?? 900));
$expiresAt = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->add(new DateInterval('PT' . $ttlSeconds . 'S'));

$quizRepository->createRecoveryToken($tokenHash, $visitorId, $email, $expiresAt, $ipAddress);
$quizRepository->writeRecoveryAudit('recovery_request', 'accepted', $visitorId, $email, $ipAddress, [
    'expires_at' => $expiresAt->format(DateTimeInterface::ATOM),
]);

$baseUrl = trim((string) ($config['recovery_base_url'] ?? ''));
if ($baseUrl === '') {
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = (string) ($_SERVER['HTTP_HOST'] ?? 'localhost');
    $scriptDir = rtrim(str_replace('\\', '/', dirname((string) ($_SERVER['SCRIPT_NAME'] ?? '/api/v1/request_recovery.php'))), '/');
    $basePath = preg_replace('#/api/v1$#', '', $scriptDir) ?: '';
    $baseUrl = $scheme . '://' . $host . $basePath;
}

$recoveryLink = rtrim($baseUrl, '/') . '/index.php?recovery_token=' . urlencode($rawToken);
$isDevelopment = in_array(strtolower((string) ($config['app_env'] ?? 'production')), ['dev', 'development', 'local'], true);

if ($isDevelopment) {
    $quizRepository->writeRecoveryAudit('recovery_email', 'sent_mock', $visitorId, $email, $ipAddress);
    json_success([
        'ok' => true,
        'expires_at' => $expiresAt->format(DateTimeInterface::ATOM),
        'delivery' => 'mock',
        'recovery_link' => $recoveryLink,
    ]);
}

$subject = 'Herstel je testvoortgang';
$message = "Klik op deze link om je voortgang te herstellen (geldig voor " . (int) floor($ttlSeconds / 60) . " minuten):\n\n" . $recoveryLink;
$headers = [
    'From: ' . (string) ($config['recovery_email_from'] ?? 'no-reply@example.test'),
    'Content-Type: text/plain; charset=UTF-8',
];

$sent = mail($email, $subject, $message, implode("\r\n", $headers));
if (!$sent) {
    $quizRepository->writeRecoveryAudit('recovery_email', 'send_failed', $visitorId, $email, $ipAddress);
    json_error('Unable to send recovery email right now.', 500);
}

$quizRepository->writeRecoveryAudit('recovery_email', 'sent', $visitorId, $email, $ipAddress);

json_success([
    'ok' => true,
    'expires_at' => $expiresAt->format(DateTimeInterface::ATOM),
    'delivery' => 'email',
]);
