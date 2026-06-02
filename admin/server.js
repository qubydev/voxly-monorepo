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
                s.balance, s.is_unlimited as "isUnlimited", s.plan_type as "planType",
                s.cycle_ends_at as "cycleEndsAt", s.subscription_ends_at as "subscriptionEndsAt"
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
    const { userId, subType, months } = req.body;
    const n = parseInt(months, 10) || 1;

    let balance = 0;
    let isUnlimited = false;
    let planType = 'NONE';

    if (subType === '1M_CREDITS') {
        balance = 1000000;
        isUnlimited = false;
        planType = '1M_CREDITS';
    } else if (subType === 'UNLIMITED') {
        balance = 0;
        isUnlimited = true;
        planType = 'UNLIMITED';
    }

    const cycleEndsAt = new Date();
    cycleEndsAt.setMonth(cycleEndsAt.getMonth() + 1);

    const subscriptionEndsAt = new Date();
    subscriptionEndsAt.setMonth(subscriptionEndsAt.getMonth() + n);

    try {
        const query = `
            INSERT INTO "subscription" (user_id, balance, is_unlimited, plan_type, cycle_ends_at, subscription_ends_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                balance = EXCLUDED.balance,
                is_unlimited = EXCLUDED.is_unlimited,
                plan_type = EXCLUDED.plan_type,
                cycle_ends_at = EXCLUDED.cycle_ends_at,
                subscription_ends_at = EXCLUDED.subscription_ends_at,
                updated_at = NOW()
        `;
        await pool.query(query, [userId, balance, isUnlimited, planType, cycleEndsAt, subscriptionEndsAt]);
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