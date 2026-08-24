import { createClient } from 'redis';

async function testRedis() {
  try {
    const client = createClient({ url: 'redis://127.0.0.1:6379' });
    client.on('error', (err) => console.log('Redis Client Error:', err));
    
    await client.connect();

    // Test PING
    const pong = await client.ping();
    console.log('PING:', pong); // PONG

    // Thêm key
    await client.set('myKey', 'myValue', { EX: 60 }); // EX: ttl 60 giây
    console.log('Set key "myKey" thành công');

    // Lấy key
    const value = await client.get('myKey');
    console.log('Value of myKey:', value); // 'myValue'

    await client.quit();
  } catch (err) {
    console.error('Connection failed:', err);
  }
}

testRedis();
