-- الملخص اليومي الساعة 8:00 صباحاً بتوقيت بغداد (05:00 UTC) بدل 6:00 كي لا يقع ضمن وضع النوم في الهاتف
select cron.schedule('mylegal-daily-notifications', '0 5 * * *', $$select app.generate_notifications()$$);
