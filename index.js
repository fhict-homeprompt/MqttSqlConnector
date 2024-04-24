import mysql from 'mysql2/promise';
import mqtt from 'mqtt';

const client = mqtt.connect('mqtt://test.mosquitto.org');

const connection = await mysql.createConnection({
    host: '192.168.124.22',
    user: '',
    password: '',
    database: 'homeprompt',
}).catch((err) => {
    throw err;
});

function setLastSeen(sensorId) {
    connection.execute(
        'UPDATE `sensor` SET `lastseen` = NOW() WHERE `id` = ?',
        [sensorId]).catch((err) => {
            throw err;
        });
}

async function insertLightAlarm(sensorId) {
    const [result] = await connection.execute(
        'INSERT INTO `alarm` (`sensor_id`, `type`, `trigger_time`) VALUES (?, ?, NOW())',
        [sensorId, 'LightTreshold']);
    console.log(`Light alarm inserted with ID ${result.insertId}`);
}

async function endLightAlarm(sensorId) {
    const [result] = await connection.execute(
        'UPDATE `alarm` SET `reset_time` = NOW() WHERE `sensor_id` = ? AND `reset_time` IS NULL',
        [sensorId]);
    if (result.affectedRows > 0) {
        console.log(`Light alarm ended for sensor ${sensorId}`);
    }
}

function onMessage(topic, message) {
    let topicSplit = topic.split('/');
    if (topicSplit.length != 4) {
        throw new Error('Invalid topic');
    }
    let sensorId = topicSplit[2];
    let messageType = topicSplit[3];
    switch (messageType) {
        case 'alive':
            setLastSeen(sensorId);
            break;
        case 'alert':
            let [alertType, alertValue] = message.toString().split(',');
            if (alertType == 'LightTresholdExceeded')
                insertLightAlarm(sensorId);
            else if (alertType == 'LightTresholdNormal')
                endLightAlarm(sensorId);
            break;
    }
}

client.on("message", onMessage);

try {
    const [results] = await connection.query('SELECT * FROM `sensor`');
    results.forEach(element => {
        client.subscribeAsync(`homeprompt/sensor/${element.id}/#`);
    });
} catch (err) {
    throw err;
}
