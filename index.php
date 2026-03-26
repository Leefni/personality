<?php
declare(strict_types=1);

$config = require __DIR__ . '/config.php';
$privacyRetentionText = (string) ($config['privacy_retention_text'] ?? '');
$appEnv = (string) ($config['app_env'] ?? 'production');

// Security headers for the HTML page.
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: strict-origin-when-cross-origin');
header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'");

$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host = (string) ($_SERVER['HTTP_HOST'] ?? 'localhost');
$scriptDir = rtrim(str_replace('\\', '/', dirname((string) ($_SERVER['SCRIPT_NAME'] ?? '/index.php'))), '/');
$basePath = $scriptDir === '/' ? '' : $scriptDir;
$baseUrl = $scheme . '://' . $host . $basePath;
$canonicalUrl = rtrim($baseUrl, '/') . '/index.php';

$metaTitle = 'Personality Test – Ontdek jouw persoonlijkheidstype';
$metaDescription = 'Doe de Personality Test en ontdek jouw persoonlijkheidstype op basis van EI, SN, TF en JP dimensies.';
?>
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="theme-color" content="#1d4ed8" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#0f172a" media="(prefers-color-scheme: dark)">
  <title><?php echo htmlspecialchars($metaTitle, ENT_QUOTES, 'UTF-8'); ?></title>
  <meta name="description" content="<?php echo htmlspecialchars($metaDescription, ENT_QUOTES, 'UTF-8'); ?>">

  <meta property="og:title" content="<?php echo htmlspecialchars($metaTitle, ENT_QUOTES, 'UTF-8'); ?>">
  <meta property="og:description" content="<?php echo htmlspecialchars($metaDescription, ENT_QUOTES, 'UTF-8'); ?>">
  <meta property="og:type" content="website">
  <meta property="og:url" content="<?php echo htmlspecialchars($canonicalUrl, ENT_QUOTES, 'UTF-8'); ?>">

  <link rel="icon" type="image/svg+xml" href="<?php echo htmlspecialchars($basePath . '/favicon.svg', ENT_QUOTES, 'UTF-8'); ?>">
  <link rel="stylesheet" href="assets/style.css">
</head>
<body>
  <noscript>
    <p>Deze website werkt alleen met JavaScript. Zet JavaScript aan om de test te gebruiken.</p>
  </noscript>
  <main class="container" data-app-env="<?php echo htmlspecialchars($appEnv, ENT_QUOTES, 'UTF-8'); ?>">
    <h1>Personality Test</h1>
    <p class="progress" id="progress">Laden...</p>
    <p class="test-meta" id="test-meta">Testversie laden...</p>

    <section class="privacy-note" aria-label="Privacy" hidden>
      <p><strong>Privacy:</strong> <?php echo htmlspecialchars($privacyRetentionText, ENT_QUOTES, 'UTF-8'); ?></p>
      <button type="button" class="danger" id="delete-data-start">Verwijder mijn gegevens</button>
    </section>

    <section class="about-test" aria-labelledby="about-test-title" hidden>
      <h2 id="about-test-title">Voor je start</h2>
      <ul>
        <li><strong>Verwachte duur:</strong> Deze test duurt ongeveer ±15 minuten.</li>
        <li><strong>Uitleg antwoordschaal:</strong> Beantwoord elke stelling op een schaal van ‘helemaal oneens’ tot ‘helemaal eens’. Kies je eerste, natuurlijke reactie; er zijn geen goede of foute antwoorden.</li>
        <li><strong>Voortgang opslaan:</strong> Je voortgang kan automatisch bewaard en later hersteld worden via e-mail (optioneel).</li>
      </ul>
      <p class="subtle-disclaimer">Dit is een indicatief instrument voor zelfreflectie en geen klinische diagnose.</p>
    </section>

    <section id="questions"></section>
    <nav class="nav" id="nav"></nav>
    <section class="recovery-prompt is-hidden" id="recovery-prompt" aria-label="Voortgang herstellen">
      <button type="button" class="recovery-trigger" id="recovery-toggle" aria-expanded="false" aria-controls="recovery-panel">
        Wil je later verder? Bewaar je voortgang via e-mail.
      </button>
      <p class="recovery-subtext">Optioneel — je kunt ook direct doorgaan zonder op te slaan.</p>
      <div class="recovery-panel" id="recovery-panel" hidden>
        <div class="recovery-controls">
          <input type="email" id="recovery-email" placeholder="jij@example.com" autocomplete="email">
          <button type="button" id="recovery-request">Stuur herstel-link</button>
        </div>
      </div>
      <p class="recovery-status" id="recovery-status" aria-live="polite"></p>
    </section>
    <section class="result" id="result"></section>
  </main>

  <div class="loading-overlay" id="loading-overlay" hidden aria-hidden="true">
    <div class="loading-overlay__panel" role="status" aria-live="polite" aria-atomic="true">
      <span class="loading-overlay__spinner" aria-hidden="true"></span>
      <ul class="loading-overlay__messages" aria-hidden="true">
        <li>Analyzing your personality...</li>
        <li>Calculating results...</li>
        <li>Generating your personality profile...</li>
      </ul>
      <p class="loading-overlay__live" id="loading-overlay-live">Analyzing your personality...</p>
    </div>
  </div>

  <script type="module" src="assets/app.js"></script>
</body>
</html>
