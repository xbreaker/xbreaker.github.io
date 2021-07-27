---
title: "Использование своего Dynamic DNS сервиса на Ubiquiti Unifi Dream Machine"
description: "Настройка стороннего Dynamic DNS провайдера в обход предустановленных на Ubiquiti Unifi Dream Machine"
summary: "Ubiquiti UDM для настройки сервиса Dynamic DNS предлагает достаточно ограниченный список провайдеров и не торопится этот список расширять. Посмотрим как можно обойти это ограничение и добавить поддержку своего собственного провайдера."
date: 2021-06-08T17:46:06+03:00
draft: false
tags: ["udm", "udm pro", "ubiquiti", "dyndns", "inadyn"]
cover:
    image: /img/posts/dyndns_udm_0.png
slug: "custom-dyndns-for-udm"
---

После перехода с FreshTomato на UnifiOS первым делом возникла необходимость переноса настроек Dynamic DNS. На UDM для настройки доступен лишь небольшой список предустановленных провайдеров dynamic dns, требующих оплату за свою работу. Такой вариант меня не устраивал поэтому было решено посмотреть как это устроено внутри и есть ли вариант использовать своего провайдера.

Поэтому для начала разберемся каким образом это можно сделать и возможно ли вообще это сделать на Unifi Dream Machine. И позволяют ли другие провайдеры настраивать обновление dynamic DNS? Какие настройки требуются для этого?

### Принцип работы Dynamic DNS на UDM

Первым делом я решил проверить логи, для этого я выполнил настройки с левыми данными, чтобы появились ошибки:

{{< figure src="/img/posts/dyndns_udm_1.png" caption="Пробные настройки" >}}

Смотрим логи:

{{< highlight bash >}}
# tail -20 /var/log/messages
Jun 07 11:20:36 router user.notice inadyn[5437]: In-a-dyn version 2.5 -- Dynamic DNS update client.
Jun 07 11:20:36 router user.warn inadyn[5437]: Guessing DDNS plugin 'default@freedns.afraid.org' from 'afraid'
Jun 07 11:20:36 router user.notice inadyn[5437]: Update forced for alias test.test.com, new IP# 1.1.1.1
Jun 07 11:20:43 router user.warn inadyn[5437]: HTTP(S) Transaction failed, error 36: Temporary network error (HTTPS send)
{{< /highlight >}}

По логам видно, что для обновления IP используется [Internet Automated Dynamic DNS Client](https://github.com/troglobit/inadyn) (Inadyn) - библиотека с открытым исходным кодом! 

Данная библиотека обладает превосходной документацией, а так же поддерживает намного больше провайдеров Dynamic DNS, чем доступно в UnifiOS. Однако, в моем случае нужного мне провайдера не оказалось в списке, а значит придется искать другой путь. К счастью, Inadyn поддерживает кастомные настройки, то есть можно параметризировать любое доступное API и Inadyn сможет с ним взаимодействовать. 

Осталось выяснить какие параметры нам нужны, для этого можно поискать описание стандартных сервисов, например, такое есть у Oracle и его сервиса dyn.com. [Согласно ей](https://help.dyn.com/remote-access-api/perform-update/) нам необходимо формировать запросы вида:


{{< highlight bash >}}
GET /nic/update?hostname=home.dyn.com&myip=192.168.0.1 HTTP/1.0
Host: ddns.dyn.com
Authorization: Basic AuthBase64
{{< /highlight >}}

А в ответ получать:

{{< highlight bash >}}
HTTP/1.0 200 OK
Content-Length: 4
Content-Type: text/plain
good
{{< /highlight >}}

Осталось собрать простое приложение, которое будет принимать указанные запросы и отвечать в заданном формате, я собрал его на NodeJS и запустил на Heroku:

{{< highlight js "linenos=table" >}}
var express = require('express');
var app = express();

var ip = function( req, res ) {
    if (req.headers['authorization']) {
        auth = new Buffer(req.headers['authorization'].substring(6), 'base64').toString().split(':');

        if (auth && auth[0] === process.env.BASIC_AUTH_LOGIN && auth[1] === process.env.BASIC_AUTH_PASS ) {
            console.log( 'Auth:', auth );
            if( typeof res =='function' ) {
                res(null, "good")
            } else {
                res.send("good");
            }
        }
    }
    if(req.headers['user-agent']) {
        console.log( 'User-Agent:', req.headers['user-agent'] );
    }
}

app.get('nic/update?hostname=:name&myip=:ip', ip);
app.get('/', function (req, res) {
  res.send('bad');
});

app.listen(process.env.PORT || 3000)
console.log('Listening on port 3000...');
{{< /highlight >}}

После этого попробовал настроить UDM на запросы к моему серверу, в поле Server вписал адрес приложения Heroku: 

{{< figure src="/img/posts/dyndns_udm_2.png" caption="Попытка номер 2" >}}

После этого запустил просмотр логов приложения и к нему не было ни одного обращения. Пришлось вернуться в UDM и посмотреть логи там:

{{< highlight bash >}}
Jun 07 12:46:32 Home user.warn inadyn[18541]: Fatal error in DDNS server response:
Jun 07 12:46:32 Home user.warn inadyn[18541]: [400 Bad Request] 400 Bad Request
Jun 07 12:46:32 Home user.warn inadyn[18541]: Error response from DDNS server, ignoring ...
{{< /highlight >}}

Да уж, краткость - сестра таланта. Плюс Inadyn запускается только при смене IP адреса, а для отладки нужна возможность ручного запуска, еще желательно иметь более подробные логи. По документации можно заставить Inadyn писать подробные логи на экран, только нужно правильно указать файл конфигурации - на UDM он расположен по пути `/run/inadyn.conf`, а полностью команда запуска будет выглядеть:

{{< highlight bash >}}
# /usr/sbin/inadyn -n -s -C -f /run/inadyn.conf -1 -l debug --foreground
{{< /highlight >}}

Результат запроса к моему серверу:

{{< highlight bash >}}
GET test.test.com HTTP/1.0
Host: app.myherokuapp.com
Authorization: Basic rFrt............................A==
User-Agent: inadyn/2.5 https://github.com/troglobit/inadyn/issues
{{< /highlight >}}

Здесь явно чего-то не хватает - UDM запрашивает лишь hostname напрямую, без всяких параметров. Посмотрим, что содержится в файле конфига `/run/inadyn.comf`:

{{< highlight bash >}}
#
# Generated automatically by ubios-udapi-server
#
iface = eth8
custom app.myherokuapp.com {
    hostname = "test.test.com"
    username = "test"
    password = "test"
    ddns-server = "app.myherokuapp.com"
}
{{< /highlight >}}

Судя по форумам нам не хватает дополнительной строки параметров `ddns-path`. Поискав по форумам, я нашел, что в поле Server кроме домена можно так же передавать и параметры, тогда появится и наша дополнительная строка. Более того, оказалось, что каждый раз, когда заполняется строка Server, то Inadyn воспринимает всю конфигурацию как кастомную, и не важно какой провайдер был выбран выше, он будет проигнорирован. Добавив новые значения в поле Server мы получим и нашу новую строку:

{{< highlight bash >}}
	ddns-path = "/nic/update?hostname=%h&myip=%i"
{{< /highlight >}}

Без этой строки, по конфигурации выше, наш запрос выглядел вот так `app.myherokuapp.com/test.test.com`. Смотрим документацию - там есть описание параметров:

{{< highlight bash >}}
%u - username, if HTTP basic auth is not used
%p - password, if HTTP basic auth is not used
%h - hostname
%i - current IP address
{{< /highlight >}}

Прекрасно, пробуем заполнить строку Server с указанием параметров, то есть `app.myherokuapp.com/nic/update?hostname=%h&myip=%i`, получаем конфиг:

{{< highlight bash >}}
#
# Generated automatically by ubios-udapi-server
#
iface = eth8
custom app.myherokuapp.com {
    hostname = "test.test.com"
    username = "test"
    password = "test"
    ddns-server = "app.myherokuapp.com"
	ddns-path = "/nic/update?hostname=%h&myip=%i"
}
{{< /highlight >}}

Запустил вручную Inadyn и все отработало как надо, мое приложение вернуло good, однако при запуске после сохранения настроек и переход на автоматический запуск через UDM - ничего не работает, причина:

{{< highlight bash >}}
GET nic/update?hostname=test.test.com&myip=192.168.0.1test.test.com HTTP/1.0
Host: app.myherokuapp.com
Authorization: Basic rFrt............................A==
User-Agent: inadyn/2.5 https://github.com/troglobit/inadyn/issues
{{< /highlight >}}

Причина в приклеенном к запросу адресом хоста, решение этой проблемы заняло не мало времени и ответ был найден на [официальном форуме](https://community.ui.com/questions/UDM-DynDNS-Google-Domains/fe9ba35d-66c3-437d-8323-debe2af55879?page=1). В адресе параметров необходимо добавить обратный слэш после домена и тогда адрес хоста не будет приклеиваться в конец запроса:

{{< highlight bash >}}
ddns-path = "\/nic/update?hostname=%h&myip=%i"
{{< /highlight >}}

И наш итоговый конфиг:

{{< figure src="/img/posts/dyndns_udm_3.png" caption="Итоговый конфиг" >}}

Проверим результат в логах:

{{< highlight bash >}}
# cat /var/log/messages | grep inadyn
Jun 07 18:12:03 router user.notice inadyn[13088]: In-a-dyn version 2.5 -- Dynamic DNS update client.
Jun 07 18:12:03 router user.notice inadyn[13088]: Update forced for alias test.test.com, new IP# 1.2.3.4
Jun 07 18:12:04 router user.notice inadyn[13088]: Updating cache for test.test.com
{{< /highlight >}}

Итого:
1. Заполнение поля Server в настройках включает игнор провайдера выбранного из списка и позволяет кастомно настраивать Dynamic DNS;
2. В поле Server нужно вписывать адрес без https, ее Inadyn добавит самостоятельно (выполнять запросы к HTTP не получится);
3. Inadyn кэширует удачные запросы и сохраняет IP, если он был обновлен - достаточно удалить `/.inadyn`, если запуск происходит по настройкам. Если запускаете вручную командой, то кэш будет расположен по пути `/root/.inadyn`;