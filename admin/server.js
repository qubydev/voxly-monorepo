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
                s.plan_type as "planType", s.status,
                s.credits_included as "creditsIncluded",
                s.credits_remaining as "creditsRemaining",
                s.current_period_start as "currentPeriodStart",
                s.current_period_end as "currentPeriodEnd",
                s.cancelled_at as "cancelledAt",
                s.expired_at as "expiredAt"
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

    let creditsIncluded = 0;
    let creditsRemaining = 0;
    let planType = null;

    if (subType === 'CREDITS_1M') {
        creditsIncluded = 1000000;
        creditsRemaining = 1000000;
        planType = 'CREDITS_1M';
    } else if (subType === 'UNLIMITED_1M') {
        planType = 'UNLIMITED_1M';
    } else {
        return res.status(400).send('Invalid subscription type');
    }

    const periodStart = new Date();
    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    try {
        const query = `
            INSERT INTO "subscription" (
                user_id, plan_type, status, credits_included, credits_remaining,
                current_period_start, current_period_end, cancelled_at, expired_at, updated_at
            )
            VALUES ($1, $2, 'active', $3, $4, $5, $6, NULL, NULL, NOW())
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                plan_type = EXCLUDED.plan_type,
                status = 'active',
                credits_included = EXCLUDED.credits_included,
                credits_remaining = EXCLUDED.credits_remaining,
                current_period_start = EXCLUDED.current_period_start,
                current_period_end = EXCLUDED.current_period_end,
                cancelled_at = NULL,
                expired_at = NULL,
                updated_at = NOW()
        `;
        await pool.query(query, [userId, planType, creditsIncluded, creditsRemaining, periodStart, periodEnd]);
        res.redirect('/');
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post('/admin/remove-subscription', async (req, res) => {
    const { userId } = req.body;
    try {
        const query = `
            UPDATE "subscription"
            SET status = 'cancelled',
                credits_remaining = 0,
                cancelled_at = NOW(),
                updated_at = NOW()
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
