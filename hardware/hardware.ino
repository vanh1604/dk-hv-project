#include <Arduino.h>
#define DEBUG true
#include <ESP8266WiFi.h>  //thu vien wifi cho esp8266
#include <SocketIOClient.h> //thu vien socket de giao tiep
#include <ArduinoJson.h>  //thu vien cho phan tich json
#include <Wire.h> //thu vien cho I2C
#include "MAX30100_PulseOximeter.h" //thuvien cho cam bien nhip tim va o2
#include <Adafruit_MLX90614.h> //thu vien cho cam bien than nhiet
#include <TinyGPSPlus.h>     //thu vien cho viec giao tiep voi gps
#include <SoftwareSerial.h>     //thu vien cho ket noi uart (khong dung chan tx va rx mac dinh)

#define REPORTING_PERIOD_MS     1000  //chu ki cap nhat nhip tim, o2, than nhiet
#define RXPIN 14                      //chan rx cua softwareserial
#define TXPin 12                      //chan tx cua softwareserial
#define GPSBaud 9600                  //toc do giao tiep voi gps
/**
   ket noi wifi thanh cong
   ket noi server thanh cong
  phan tich chuoi json thanh cong : bat tat led bang json thanh cong, can nang cap them
  bat dau ket noi max30100 va cam bien nhiet do va xoa het cac cam bien khac di
  gui thanh cong nhip tim, nhiet do, oxy, CO len server, web hien thi thanh cong
  bat dau ghep gps  : xong
  bat dau test toàn bộ
*/

Adafruit_MLX90614 mlx = Adafruit_MLX90614();
PulseOximeter pox;
SocketIOClient client;
TinyGPSPlus gps;
SoftwareSerial ss(RXPin, TXPin);

char host[] = "192.168.100.88";  //Địa chỉ IP dịch vụ, hãy thay đổi nó theo địa chỉ IP Socket server của bạn.
int port = 3434;                  //Cổng dịch vụ socket server do chúng ta tạo!
uint32_t tsLastReport = 0;  //luu lai thoi gian hien tai

//extern: include cac bien toan cuc o thu vien khac
// thu vien socketio co 2 bien toan cuc ma ta can
// RID: Tên hàm (tên sự kiện)
// Rfull: Danh sách biến (được đóng gói lại là chuối JSON)
extern String RID;
extern String Rfull;

const char* ssid = "AMERICAN STUDY FLOOR 1_2G";
const char* pass = "66112268";

//Một số biến phu
float nhietdo = 0;  //luu nhiet do
float nhiptim = 0; //luu nhip tim
float oxy = 0;  //luu oxy
int CO = 0; //luu CO
float long, lat;  //luu toa do
//may cai duoi nay van chua dung
float arr_nhietdo[5] ;
float arr_nhiptim[5];
float arr_oxy[5];
//void ICACHE_RAM_ATTR button (); //khong co cai nay la khong dung interrupt duoc

void setup()
{
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, HIGH);
  //Bật baudrate ở mức 115200 để giao tiếp với máy tính qua Serial
  Serial.begin(115200);
  Serial.println("\nESP8266 wsc vong co thong minh");
  //Việc đầu tiên cần làm là kết nối vào mạng Wifi
  ketNoiWifi();
  //tiếp theo là kết nối đến server 
  ketNoiServer();
  //khoi dong software serial cho gps (gps can khoang 1ph moi co the hoat dong chinh xac)
  ss.begin(GPSBaud);
  // khoi dong cam bien nhip tim va cam bien o2
  Serial.println("Khoi tao cam bien nhip tim va cam bien oxy..");
  if (!pox.begin()) {
    Serial.println("FAILED");
    for (;;);
  } else {
    Serial.println("SUCCESS");
  }
  //neu bao failed thi uncomment dong o duoi
  //     pox.setIRLedCurrent(MAX30100_LED_CURR_7_6MA);
  Serial.println("Khoi tao cam bien than nhiet.... SUCCESS");
  mlx.begin(0x5A);
  //do cam bien than nhiet co xung clk khac max30100 nen can lam nhu nay
  Wire.setClock(100000);
}

void loop()
{
  pox.update();
  //tạo một task cứ sau "REPORTING_PERIOD_MS" giây thì chạy lệnh:
  if (millis() - tsLastReport > REPORTING_PERIOD_MS) {
    tsLastReport = millis();
    //lay so lieu
    NhipTim();
    NhietDo();
    Oxy();
    CO();
    GPS();
    // gui so lieu len server
    GuiDuLieu(nhiptim, nhietdo, oxy, CO, long, lat);
  }
  //Khi bắt được bất kỳ sự kiện nào thì chúng ta có hai tham số:
  //  +RID: Tên sự kiện
  //  +RFull: Danh sách tham số được nén thành chuỗi JSON!
  //chỉ có 1 sự kiện mà ta cần quan tâm là "UPDATE"
  if (client.monitor()) {
    Serial.print(RID + " ");
    Serial.print(Rfull);
    Serial.print("\n");
    if (RID == "UPDATE") {
      NhipTim();
      NhietDo();
      Oxy();
      CO();
      GPS();
      GuiDuLieu(nhiptim, nhietdo, oxy, CO, long, lat);
    }

  }
  //Kết nối lại!
  if (!client.connected()) {
    client.reconnect(host, port);
  }
}

void ketNoiWifi () {
  WiFi.persistent(false); //khong luu du lieu wifi
  WiFi.mode(WIFI_OFF);  //tat wifi di
  delay(1000);
  WiFi.mode(WIFI_STA); //bat wifi o che do sta
  WiFi.begin(ssid, pass); //ket noi wifi
  Serial.println("Connecting: ");
  Serial.println(WiFi.SSID());
  delay(100);
  //chờ cho đến khi kết nôi thành công
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.println(F("Dia chi IP cua ESP8266 (Socket Client ESP8266): "));
  Serial.println(WiFi.localIP());
}

void ketNoiServer() {
    if (!client.connect(host, port)) {
    Serial.println(F("Ket noi den socket server that bai! Kiem tra lai ip, host, firewall, ssid, password"));
    return;
  }
  //Khi đã kết nối thành công
  if (client.connected()) {
    client.send("connection", "message", "Connected !!!!");
    Serial.println("connected to server");
  }
}

void GPS(){
  while (ss.available()){
    gps.encode(ss.read());
    if (gps.location.isUpdate()) {
      long = gps.location.lng();
      lat = gps.location.lat();
      break;
    }
  }
}

void NhipTim() {
  nhiptim = pox.getHeartRate();
}
void NhietDo() {
  nhietdo = mlx.readObjectTempC();
}
void Oxy () {
  oxy = pox.getSpO2();
}
void CO () {
  CO = analogRead(A0);
}
void GuiDuLieu (float nhiptim, float nhietdo, float oxy, int CO, float long, float lat) {
  client.send("NHIP_TIM", "message", String(nhiptim));
  client.send("NHIET_DO", "message", String(nhietdo));
  client.send("OXY", "message", String(oxy));
  client.send("CO", "message", String(CO));
  client.send("LNG", "message", String(long,6);
  client.send("LAT", "message", String(lat, 6);
}
//da test va chay duoc, MQ2 {MQ2: data} giu lai de tham khao neu can
//void readMq2() {
//  StaticJsonDocument<16> doc;
//  //  Serial.println(analogRead(MQ2PIN));
//  doc["MQ2"] = analogRead(MQ2PIN);
//  String output;
//  serializeJson(doc, output);
//  client.sendJSON("MQ2", output);
//}
//phan tich chuoi json (cai nay giu lai co khi can dung, con co cai ma tham khao)
//      StaticJsonDocument<48> doc;
//      DeserializationError error = deserializeJson(doc, Rfull);
//      if (error) {
//        Serial.print(F("deserializeJson() failed: "));
//        Serial.println(error.f_str());
//        return;
//      }
//      //do rfull la string nen can lam nhu nay
//      JsonObject obj = doc.as<JsonObject>();
//      String led = obj["led"];
//      if (led == "true") { //active low
//        digitalWrite(LED_BUILTIN, LOW);
//        client.send("LED_BUILTIN_STATUS", "message", "ON");
//      } else {
//        digitalWrite(LED_BUILTIN, HIGH);
//        client.send("LED_BUILTIN_STATUS", "message", "OFF");
//      }