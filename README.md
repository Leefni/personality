# Personality Test (USBWebserver v8.6.6)

A lightweight PHP + MySQL personality test app with paginated questions, autosave, and a computed 4-letter result.

## Requirements

- USBWebserver v8.6.6 (Apache + PHP + MySQL)
- PHP PDO MySQL extension enabled (default in USBWebserver)

## Setup (USBWebserver)

1. Copy this project folder to your USBWebserver `root` directory.
2. Start **Apache** and **MySQL** from USBWebserver.
3. Open phpMyAdmin and import:
   - `init.sql`
   - `questions.sql`
4. Verify `config.php` matches your MySQL credentials.
5. Browse to: `http://localhost/personality/`

## Project Structure

- `index.php` - Main page
- `assets/style.css` - Styling
- `assets/app.js` - Front-end app logic
- `api/*.php` - JSON API endpoints
- `db.php` - Database bootstrap (PDO)
- `init.sql` / `questions.sql` - Database schema and seed data

## Notes

- Visitor progress is stored per browser using a `visitor_id` cookie.
- Answers autosave on each click.
- Final result is also persisted in the `results` table.
