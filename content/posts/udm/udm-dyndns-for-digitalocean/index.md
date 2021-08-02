---
title: "Использование Digital Ocean в качестве Dynamic DNS для UDM/UDM Pro"
description: "Настройка Digital Ocean в качестве Dynamic DNS провайдера на Ubiquiti Unifi Dream Machine"
summary: "Пришло время придумать резервный вариант обновления настроек Dynamic DNS в случае отказа встроенного механизма обновления на Ubiquiti Unifi Dream Machine."
date: 2021-06-20T18:42:01+03:00
draft: false
tags: ["udm", "udm pro", "ubiquiti", "digitalocean", "dyndns"]
cover:
    image: images/udm_dyndns_for_digitalocean_0.png    
slug: "/udm-dyndns-for-digitalocean"
---

Кроме основного варианта обновления Dynamic DNS, который я рассматривал [ранее]({{< ref "/posts/udm/custom-dyndns-for-udm.md" >}} "Использование своего Dynamic DNS сервиса на Ubiquti Unifi Dream Machine") я решил сделать резервный вариант обновления, так как доступ к домашнему серверу достаточно критичен и используется мной постоянно. Наиболее простой вариант резервирования - это проверка и обновление настроек Dynamic DNS по расписанию.

<!-- more --> 
Для управления своими доменами использую [Digital Ocean](https://m.do.co/c/945ae9897cbd), поэтому возникла проблема динамическим управлением доменными записями при подключении к интернету, так как дома у меня динамический "белый" IP адрес. Как мы помним основной вариант обновления настроек у меня - это приложение Heroku, которое позволяет управлять доменными записями на DigitalOcean посредством URL-запросов с авторизацией, что-то вида:

{{< highlight bash >}}
# curl -v http://test:test@myapp.herokuapp.com/dyndns/home.site.com/@IP

> GET / HTTP/1.1
> Host: myapp.herokuapp.com
> User-Agent: curl/7.71.1
> Accept: */*
>
< HTTP/1.1 200 OK
< Server: Cowboy
< Connection: keep-alive
< Content-Type: text/html; charset=utf-8
< Content-Length: 9
< Date: Mon, 11 Jan 2020 08:17:33 GMT
< Via: 1.1 vegur
<
IP for home.site.com was updated to 127.0.0.1
{{< /highlight >}}

В UDM для реализации поддержки Dynamic DNS внутри UDM используется [inadyn](https://github.com/troglobit/inadyn), более подробное исследование inadyn есть всё в той же [отдельной статье]({{< ref "/posts/udm/custom-dyndns-for-udm.md" >}} "Использование своего Dynamic DNS сервиса на Ubiquti Unifi Dream Machine"), где я рассказывал как заставить работать UDM с любым dyndns провайдером.

Кроме этого в UDM есть поддержка контейнеризации на основе [Podman](https://podman.io/) и именно её я и буду использовать - контейнер, который раз в 5 минут производит запрос к сайту определения IP, сравнивает его с IP адресом моего DynDNS хоста и, при необходимости, обновляет его.

### Подготовка Digital Ocean

Для начала проверим настройки Digital Ocean и убедимся, что у нас есть возможность управлять доменными записями через API.
Управление доменами расположено в секции Networking -> [Domains](https://cloud.digitalocean.com/networking/domains), где необходимо добавить свой домен и настроить поддомен, который мы будем использовать для Dynamic DNS, пусть для примера это будет `dyndns.aybe.org`, IP адрес пока можно ввести любой:

{{< figure src="images/udm_dyndns_for_digitalocean_1.png" caption="Добавление новой записи для домена" >}}

Второй шаг - создание API токена, с помощью которого мы будем обновлять эту доменную запись. Управление токенам расположено в разделе [API](https://cloud.digitalocean.com/account/api/tokens), где нажимаем кнопку *Generate New Token* и вводим его название, чтобы было понятно для чего он, например `udm-dyndns-token`. Обязательно ставим галку напротив Write, чтобы у токена были права на запись:

{{< figure src="images/udm_dyndns_for_digitalocean_2.png" caption="Создание API токена" >}}

После создания не забываем скопировать его, так как в дальнейшем подсмотреть его будет нельзя, только удалить старый и создать новый:

{{< figure src="images/udm_dyndns_for_digitalocean_3.png" caption="Скопируйте и сохраните значение токена" >}}

### Настройка UDM

Переходим ко второй части - к контейнеру. Так как у меня уже установлены [udm-utilities](https://github.com/boostchicken/udm-utilities) и есть возможность автозапуска после рестарта роутера, а значит уже все готово к использованию Podman и его контейнеров, осталось только написать или найти нужный. Самому реализовывать не пришлось, так как нашел готовую репу - [digitalocean-dyndns](https://github.com/tunix/digitalocean-dyndns).

Команда запуска для Podman будет выглядеть так:

{{< highlight bash >}}
# podman run -d --network=host --restart always \
	--name dyndns \
	-e DIGITALOCEAN_TOKEN="737e7...................................ef6ab" \
	-e DOMAIN="aybe.org" \
	-e NAME="dyndns" \
	-e SLEEP_INTERVAL=300 \
	-e REMOVE_DUPLICATES="true" \
	tunix/digitalocean-dyndns
{{< /highlight >}}

После завершения работы команды можно проверить, что контейнер создался и запущен:

{{< highlight bash >}}
# podman ps
CONTAINER ID  IMAGE                                       COMMAND               CREATED       STATUS          PORTS  NAMES
dfa88f5bab0e  tunix/digitalocean-dyndns:latest                                  1 mins ago    Up 1 mins ago          dyndns
{{< /highlight >}}

Однако, IP в моем случае не обновился, а значит контейнер работает некорректно. Проверяем логи, а там одни ошибки:

{{< highlight bash >}}
# podman logs dyndns
standard_init_linux.go:178: exec user process caused “exec format error”
standard_init_linux.go:178: exec user process caused “exec format error”
standard_init_linux.go:178: exec user process caused “exec format error”
standard_init_linux.go:178: exec user process caused “exec format error”
standard_init_linux.go:178: exec user process caused “exec format error”
standard_init_linux.go:178: exec user process caused “exec format error”
standard_init_linux.go:178: exec user process caused “exec format error”
{{< /highlight >}}

[Оказалось](https://stackoverflow.com/a/67755255), что контейнер собран для архитектуры, которая не подходит для UDM, так как у нас используется архитектура arm64, а в контейнере amd64:

{{< highlight bash >}}
# podman inspect 5250704bc580 | grep "Architecture"
        "Architecture": "amd64",
{{< /highlight >}}

Поэтому скрипт внутри контейнера просто не запускается, следовательно, необходимо этот контейнер пересобрать под нужную нам архитектуру. К счастью, сделать это можно прямо на UDM, для начала создать каталог и скачать скрипты из репозитория:

{{< highlight bash >}}
# mkdir /mnt/data/tmpdyndns && cd "$_"
# curl -o Dockerfile https://raw.githubusercontent.com/tunix/digitalocean-dyndns/master/Dockerfile
# curl -o dyndns.sh https://raw.githubusercontent.com/tunix/digitalocean-dyndns/master/dyndns.sh
# chmod +x dyndns.sh
{{< /highlight >}}

После этого можно собрать контейнер под нашу платформу и сразу проверить, что image создался, а также удалить стандартный, который нам не подходит:

{{< highlight bash >}}
# podman build -t tunix/digitalocean-dyndns --platform linux/arm64 .
# podman images
REPOSITORY                            TAG       IMAGE ID       CREATED        SIZE      R/O
localhost/tunix/digitalocean-dyndns   latest    b7c3b250bbac   3 mins ago     11.2 MB   false
docker.io/tunix/digitalocean-dyndns   latest    5250704bc580   15 mins ago    11.6 MB   false
docker.io/library/alpine              latest    b0e47758dc53   3 mins ago     5.6 MB    false
# podman container stop dyndns
# podman container rm dyndns
# podman image rm 5250704bc580
Untagged: docker.io/tunix/digitalocean-dyndns:latest
Deleted: 5250704bc580f4761dfc0692046b6dc5e9e1bcc184dad131d5f065cf3feaa89a
{{< /highlight >}}

Повторяем команду создания и запуска контейнера с использованием нового образа, и проверяем в логах что все работает:
{{< highlight bash >}}
# podman run -d --network=host --restart always \
	--name dyndns \
	-e DIGITALOCEAN_TOKEN="737e7...................................ef6ab" \
	-e DOMAIN="aybe.org" \
	-e NAME="dyndns" \
	-e SLEEP_INTERVAL=300 \
	-e REMOVE_DUPLICATES="true" \
	localhost/tunix/digitalocean-dyndns
# podman ps
CONTAINER ID  IMAGE                                       COMMAND               CREATED       STATUS          PORTS  NAMES
dfa88f5bab0e  localhost/tunix/digitalocean-dyndns:latest                        3 mins ago    Up 3 mins ago          dyndns
# podman logs dyndns
Trying with ifconfig.co...
Trying with ipinfo.io/ip...
Found IP address 5.11.11.11
existing DNS record address (127.0.0.1) doesn't match current IP (5.11.11.11), 
sending data={"type": "A", "name": "dyndns", "data": "5.11.11.11"} 
to url=https://api.digitalocean.com/v2/domains/aybe.org/records/1111111
{{< /highlight >}}

Теперь все работает корректно, осталось реализовать старт контейнера при перезагрузке роутера или обновлении, для этого в каталоге `/mnt/data/on_bood.d/` создадим новый файл `10-dyndns.sh` со следующим содержимым:

{{< highlight bash >}}
#!/bin/sh
CONTAINER=dyndns

if podman container exists ${CONTAINER}; then
  podman start ${CONTAINER}
else
  logger -s -t podman -p ERROR Container $CONTAINER not found, make sure you set the proper name, you can ignore this error if it is your first time setting it up
fi
{{< /highlight >}}

Если у вас нет каталога `on_boot.d`, то значит у вас не установлены [udm-utilities](https://github.com/boostchicken/udm-utilities), необходимо установить их. Не забываем сделать этот файл исполняемым:

{{< highlight bash >}}
# chmod +x 10-dyndns.sh
{{< /highlight >}}

На этом настройку можно считать завершенной.

>Если вы ранее не использовали Digital Ocean и хотите попробовать, то предлагаю использовать [реферальную ссылку](https://m.do.co/c/945ae9897cbd), с которой вы получите 100 долларов на счет после регистрации, которые будут доступны вам 60 дней.