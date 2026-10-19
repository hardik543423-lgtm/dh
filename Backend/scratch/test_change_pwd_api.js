import 'dotenv/config';

async function test() {
    try {
        // 1. Login to get token
        const loginRes = await fetch('http://localhost:8080/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                identifier: '9428978180',
                password: '2005'
            })
        });
        const loginData = await loginRes.json();
        console.log('Login Response status:', loginRes.status);
        console.log('Login Response body:', loginData);

        if (!loginData.success) {
            console.log('Login failed');
            return;
        }

        const token = loginData.token;

        // 2. Change password API call (testing incorrect old password first)
        const wrongChangeRes = await fetch('http://localhost:8080/api/auth/change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                oldPassword: 'wrong_password',
                newPassword: '2005'
            })
        });
        const wrongChangeData = await wrongChangeRes.json();
        console.log('\nWrong Change Password status:', wrongChangeRes.status);
        console.log('Wrong Change Password body:', wrongChangeData);

        // 3. Change password API call (testing correct old password)
        const correctChangeRes = await fetch('http://localhost:8080/api/auth/change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                oldPassword: '2005',
                newPassword: '2005'
            })
        });
        const correctChangeData = await correctChangeRes.json();
        console.log('\nCorrect Change Password status:', correctChangeRes.status);
        console.log('Correct Change Password body:', correctChangeData);

    } catch (e) {
        console.error('Fetch error:', e);
    }
}
test();
