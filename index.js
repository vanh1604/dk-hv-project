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
let io = socketIo(http);

app.get("/", (req, res) => {
    res.sendFile(__dirname + '/public/neck.html');
})
// app.listen(PORT);
http.listen(PORT)
console.log("Server nodejs chay tai dia chi: " + ip.address() + ":" + PORT)

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
function broadcast(socket, data) {
    for (let i = 0; i < clients.length; i++) {
        if (clients[i] !== socket) {
            clients[i].send(data);
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
    }, 5000)//5000ms

    /*event handler cho esp client*/
    //led status, cai nay co the bo di
    socket.on('LED_STATUS', function(message) {
        broadcast(socket, message); //gui lai thong tin ve cho web client
        console.log("LED: ", message.message);  //log
    });
    //mq2
    socket.on('MQ2', (message) => {
        broadcast(socket, message); //gui lai thong tin ve cho web client
        console.log("MQ2: ", message.message)
    })
    //button    //cai nay cung co the bo di
    let pressed = 0;
    socket.on('BTN', (data)=> {
        pressed ++;
        console.log("Pressed: ", pressed);
        broadcast(socket, `${pressed}`); //gui lai thong tin ve cho web client
        console.log(data.message)
    })
    //HCSR501
    socket.on('HCSR501', (message) => {
        broadcast(socket, message); //gui lai thong tin ve cho web client
        console.log(message.message)
    })
    //cam bien than nhiet
    socket.on('MAX30100', (message) => {
        broadcast(socket, message); //gui lai thong tin ve cho web client
        console.log(message.message);
    })
    //cam bien C0
    socket.on('CO', (message) => {
        broadcast(socket, message); //gui lai thong tin ve cho web client
        console.log(message.message);
    })
    //SPO2
    socket.on('SP02', (message) => {
        broadcast(socket, message); //gui lai thong tin ve cho web client
        console.log(message.message);
    })

    /*event handler cho web client*/
    socket.on('msg', function (data) {
        console.log(data);
        broadcast(socket, data);
    });
    socket.on('disconnect', function (data) {
        let index = clients.indexOf(socket);
        clients.splice(index,1);    //xoa client mat ket noi di
        console.log("a client disconnected");
        io.sockets.emit('totalDevice', clients.length);
        clearInterval(interval1)
    });
});

