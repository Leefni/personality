<?php
declare(strict_types=1);

$config = require __DIR__ . '/config.php';
$privacyRetentionText = (string) ($config['privacy_retention_text'] ?? '');
$appEnv = (string) ($config['app_env'] ?? 'production');

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
  <main class="container">
    <h1>Personality Test</h1>
    <p class="progress" id="progress">Laden...</p>
    <p class="test-meta" id="test-meta">Testversie laden...</p>

    <section class="privacy-note" aria-label="Privacy">
      <p><strong>Privacy:</strong> <?php echo htmlspecialchars($privacyRetentionText, ENT_QUOTES, 'UTF-8'); ?></p>
      <button type="button" class="danger" id="delete-data-start">Verwijder mijn gegevens</button>
    </section>

    <section class="about-test" aria-labelledby="about-test-title">
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

  <script>
    window.APP_ENV = <?php echo json_encode($appEnv, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>;
  </script>
  <script type="module" src="assets/app.js"></script>
</body>
</html>
