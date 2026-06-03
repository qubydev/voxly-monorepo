const express = require('express');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

app.get('/', async (req, res) => {
    try {
        const query = `
            SELECT 
                u.id, u.name, u.email, u.image,
                s.unlimited, s.balance,
                s.balance_credited as "balanceCredited",
                s.starts_at as "startsAt",
                s.ends_at as "endsAt"
            FROM "user" u
            LEFT JOIN "subscription" s ON u.id = s.user_id
            ORDER BY u.name ASC
        `;
        const { rows: users } = await pool.query(query);
        res.render('index', { users });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post('/admin/update-subscription', async (req, res) => {
    const { userId, subType } = req.body;

    let unlimited = false;
    let balance = 0;
    let balanceCredited = 0;

    if (subType === 'CREDITS_2M') {
        balance = 2000000;
        balanceCredited = 2000000;
    } else if (subType === 'UNLIMITED') {
        unlimited = true;
    } else {
        return res.status(400).send('Invalid subscription type');
    }

    const startsAt = new Date();
    const endsAt = new Date(startsAt);
    endsAt.setMonth(endsAt.getMonth() + 1);

    try {
        const query = `
            INSERT INTO "subscription" (
                user_id, unlimited, balance, balance_credited,
                starts_at, ends_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                unlimited = EXCLUDED.unlimited,
                balance = EXCLUDED.balance,
                balance_credited = EXCLUDED.balance_credited,
                starts_at = EXCLUDED.starts_at,
                ends_at = EXCLUDED.ends_at,
                updated_at = NOW()
        `;
        await pool.query(query, [userId, unlimited, balance, balanceCredited, startsAt, endsAt]);
        res.redirect('/');
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post('/admin/remove-subscription', async (req, res) => {
    const { userId } = req.body;
    try {
        const query = `
            DELETE FROM "subscription"
            WHERE user_id = $1
        `;
        await pool.query(query, [userId]);
        res.redirect('/');
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.listen(port, () => {
    console.log(`Admin dashboard running at http://localhost:${port}`);
});
