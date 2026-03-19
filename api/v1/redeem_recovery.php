<?php
declare(strict_types=1);

require __DIR__ . '/common.php';

require_method('POST');

$payload = get_json_payload();
$token = isset($payload['token']) && is_string($payload['token']) ? trim($payload['token']) : '';
if ($token === '' || strlen($token) < 32) {
    json_error('Invalid token', 422);
}

$tokenHash = hash('sha256', $token);
$ipAddress = get_client_ip();
$redeemed = $quizRepository->redeemRecoveryToken($tokenHash, $ipAddress);

if ($redeemed === null) {
    $quizRepository->writeRecoveryAudit('recovery_redeem', 'invalid_or_expired', null, null, $ipAddress);
    json_error('Token is invalid or expired.', 410);
}

set_visitor_cookie((string) $redeemed['visitor_id']);
$quizRepository->writeRecoveryAudit('recovery_redeem', 'redeemed', (string) $redeemed['visitor_id'], (string) $redeemed['email'], $ipAddress);

json_success([
    'ok' => true,
    'visitor_id' => (string) $redeemed['visitor_id'],
]);
