<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Personality Test</title>
  <link rel="stylesheet" href="assets/style.css">
</head>
<body>
  <main class="container">
    <h1>Personality Test</h1>
    <p class="progress" id="progress">Laden...</p>

    <section id="questions"></section>
    <nav class="nav" id="nav"></nav>
    <section class="result" id="result"></section>
  </main>

  <script>
    window.APP_ENV = '<?php echo getenv('APP_ENV') ?: 'production'; ?>';
  </script>
  <script src="assets/app.js"></script>
</body>
</html>
