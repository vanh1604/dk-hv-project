const PORT = 3434;
const express = require('express')
const app = express();
const http = require('http').createServer(app)
const socketIo = require('socket.io')   //phai dung phien ban 1.7.3: <script src="/socket.io/socket.io.js"></script>
const ip = require('ip');

app.use(express.static(__dirname));
app.use(express.static("public"));

let io = socketIo(http)


http.listen(PORT);
console.log("Server nodejs chay tai dia chi: " + ip.address() + ":" + PORT)
// app.listen(PORT, () => {
//     console.log("Server nodejs chay tai dia chi: " + ip.address() + ":" + PORT)
// })

app.get("/", (req, res) => {
    res.sendFile(__dirname + '/public/neck.html');
})


/**
 * phan tich du lieu nhan duoc
 * @param jsonData    raw data
 * @returns {null|any} data
 */
function parseJson(jsonData) {
    try {
        return JSON.parse(jsonData);
    } catch (error) {
        return null;
    }
}

const clients = []; //danh sach client
/**
 * msg thông qua server sẽ được gửi đi các client khác mà
 * không nhận lại tin của chính mình
 * @param socket
 * @param data
 */
function broadcast(socket, event, data) {
    for (let i = 0; i < clients.length; i++) {
        if (clients[i] !== socket) {
            clients[i].emit(event, data);
        }
    }
}

//Khi có mệt kết nối được tạo giữa Socket Client và Socket Server
io.on('connection', function (socket) {
    console.log("Connected");
    clients.push(socket);   //them client vao danh sach client dang ket noi
    io.sockets.emit('totalDevice', clients.length); //cap nhat so luong client

    /*event handler cho esp client*/
    //cam bien C0
    socket.on('CO', (message) => {
        broadcast(socket, 'CO', message); //gui lai thong tin ve cho web client
        console.log(message.message);
    })
    //OXY
    socket.on('OXY', (message) => {
        broadcast(socket, 'OXY', message); //gui lai thong tin ve cho web client
        console.log(message.message);
    })
    //cam bien nhip tim
    socket.on('NHIP_TIM', (message) => {
        broadcast(socket, 'NHIP_TIM', message);
        console.log(message.message);
    })
    //cam bien nhiet do
    socket.on('NHIET_DO', (message) => {
        broadcast(socket, 'NHIET_DO', message);
        console.log(message.message);
    })

    /*event handler cho web client*/
    socket.on('UPDATE', (data) => {
        console.log('update')
        broadcast(socket, 'UPDATE', data)
        io.sockets.emit('MAX30100', Math.floor(Math.random() * 2 + 37))
    })

    /*disconnect event*/
    socket.on('disconnect', function (data) {
        let index = clients.indexOf(socket);
        clients.splice(index, 1);    //xoa client mat ket noi di
        console.log("a client disconnected");
        io.sockets.emit('totalDevice', clients.length);
        // clearInterval(interval1)
    });
});

