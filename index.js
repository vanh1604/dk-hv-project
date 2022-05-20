const PORT = 3434;
const express =require('express')
const app = express();
const http = require('http').createServer(app)
// const server = app.listen(PORT);
const socketIo = require('socket.io')
const ip = require('ip');
app.use(express.static(__dirname));
app.use(express.static("public"));

// let app = http.createServer();
// let io = socketIo(http);
let io = new socketIo.Server(http)
// let io = socketIo(PORT);
// io.attach(http, {
//     pingInterval: 10000,
//     pingTimeout: 5000,
//     cookie: false
// })

app.get("/", (req, res) => {
    res.sendFile(__dirname + '/public/neck.html');
})
// app.listen();
http.listen(PORT, () => {
    console.log("Server nodejs chay tai dia chi: " + ip.address() + ":" + PORT)
})
// http.listen()

// console.log("Server nodejs chay tai dia chi: " + ip.address() + ":" + PORT)

/**
 * phan tich du lieu nhan duoc
 * @param jsonData	raw data
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
            clients[i].emit(event,data);
        }
    }
}

//Khi có mệt kết nối được tạo giữa Socket Client và Socket Server
io.on('connection', function(socket) {
    console.log("Connected");
    clients.push(socket);   //them client vao danh sach client dang ket noi

    io.sockets.emit('totalDevice', clients.length); //cap nhat so luong client

    let led = true
    const interval1 = setInterval(function() {
        //đảo trạng thái của mảng led, nhap nhay led
        led = !led;
        let json = {
            "led": led
        }
        socket.emit('LED', json) //Gửi lệnh LED với các tham số của của chuỗi JSON
        io.sockets.emit('MAX30100', Math.floor(Math.random()*2+37))
        io.sockets.emit('MQ2', Math.floor(Math.random()*200 + 400))
    }, 5000)//5000ms

    /*event handler cho esp client*/
    //led status, cai nay co the bo di
    socket.on('LED_STATUS', function(message) {
        broadcast(socket, 'LED_STATUS', message); //gui lai thong tin ve cho web client
        console.log("LED: ", message.message);  //log
    });
    //chi so gas: mq2
    socket.on('MQ2', (message) => {
        broadcast(socket,'MQ2', message); //gui lai thong tin ve cho web client
        console.log("MQ2: ", message.message)
    })
    //button    //cai nay cung co the bo di
    socket.on('BTN', (message)=> {
        broadcast(socket, 'BTN',message.message); //gui lai thong tin ve cho web client
        console.log(message.message)
    })
    //HCSR501
    socket.on('HCSR501', (message) => {
        broadcast(socket, 'HCSR501',message); //gui lai thong tin ve cho web client
        console.log(message.message)
    })
    //cam bien than nhiet
    socket.on('MAX30100', (message) => {
        broadcast(socket, 'MAX30100', message); //gui lai thong tin ve cho web client
        console.log(message.message);
    })
    //cam bien C0
    socket.on('CO', (message) => {
        broadcast(socket, 'CO', message); //gui lai thong tin ve cho web client
        console.log(message.message);
    })
    //SPO2
    socket.on('SP02', (message) => {
        broadcast(socket, 'SP02', message); //gui lai thong tin ve cho web client
        console.log(message.message);
    })

    /*event handler cho web client*/
    socket.on('msg', function (data) {
        console.log(data);
        broadcast(socket, 'msg',data);
    });
    socket.on('LED', (data) => {
        console.log(data);
        broadcast(socket, 'LED',data)
    })
    socket.on('UPDATE', ()=> {
        io.sockets.emit('MAX30100', Math.floor(Math.random()*2+37))
        io.sockets.emit('MQ2', Math.floor(Math.random()*200 + 400))
    })


    /*disconnect event*/
    socket.on('disconnect', function (data) {
        let index = clients.indexOf(socket);
        clients.splice(index,1);    //xoa client mat ket noi di
        console.log("a client disconnected");
        io.sockets.emit('totalDevice', clients.length);
        clearInterval(interval1)
    });
});

