---
title: Автоматическое оповещение читателей о новостях с помощью ВКонтакте
date: 2011-02-17T14:10:04+03:00
draft: false
tags: ["habr", "php", "vkontakte", "github", "development"]
showtoc: false
slug: "vkontakte-automatic-1"
---

### Предисловие

Те из вас, кто пользуется социальной сетью ВКонтакте и подписан на официальную страничку [Хабры](http://vkontakte.ru/habr "Хабр") в ней, заметили, что все новые топики с главной появляются на страничке в виде сообщений-ссылок:

![](/img/posts/vk_integration_0.png)

Так вот, если у вас есть свой блог и вы хотите на своей личной страничке публиковать такие же сообщения-ссылки автоматически --- топик может быть вам интересен. Сегодня мы попробуем публиковать простые сообщения ссылки, а далее добавлять к ним «превью»-картинки.

### Реализация

Итак, для работы нам понадобится PHP с подключенным модулем curl. Для взаимодействия с сайтом ВКонтакте нам потребуется проходить авторизацию на нем, а так же получать значение уникальной переменной posthash, которая передается при публикации каждой записи на вашей стенке.

Рассмотрим простейшую функцию авторизации:

{{< highlight php >}}
function _auth( $cookies ) {
    $e = urlencode('my@email.ru'); //mail
    $p = urlencode('password');    //password
    $c = curl_init();
    $s = 'act=login&q=1&al_frame=1&expire=&captcha_sid=&captcha_key=&from_host=vkontakte.ru&email=' . $e . '&pass=' . $p;
    curl_setopt($c, CURLOPT_URL,'http://login.vk.com/?act=login');
    curl_setopt($c, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($c, CURLOPT_FOLLOWLOCATION, 1);
    curl_setopt($c, CURLOPT_COOKIEJAR, $cookies);
    curl_setopt($c, CURLOPT_POST, 1);
    curl_setopt($c, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows; U; Windows NT 6.1; ru; rv:1.9.2.13) Gecko/20101203 Firefox/3.6.13)');
    curl_setopt($c, CURLOPT_POSTFIELDS, $s);
    $r = curl_exec($c);
    curl_close($c);
  }
{{< /highlight >}}

В качестве единственной переменной функции мы передаем путь до файла с cookies, где сохраняем данные авторизации. В дальнейшем, при заходе на свою страничку, мы будем проверять авторизованы ли мы и если нет, то повторно запускать данную функцию.

Теперь нам необходима функция для получения id текущего пользователя, значения его posthash переменной, а также значение переменной id из блока handlePageParams, которая определяет какой пользователь в данный момент просматривает страницу --- если он равен 0, то значит мы не авторизованы и необходимо обратиться к выше приведенной функции. Итак:

{{< highlight php >}}
function _params($cookies) {
    $c = curl_init();
    curl_setopt($c, CURLOPT_HEADER, 1);
    curl_setopt($c, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($c, CURLOPT_REFERER, 'http://vkontakte.ru/settings.php');
    curl_setopt($c, CURLOPT_FOLLOWLOCATION, 1);
    curl_setopt($c, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows; U; Windows NT 6.1; ru; rv:1.9.2.13) Gecko/20101203 Firefox/3.6.13');
    curl_setopt($c, CURLOPT_COOKIEJAR, $cookies);
    curl_setopt($c, CURLOPT_COOKIEFILE, $cookies);
    curl_setopt($c, CURLOPT_URL, 'http://vkontakte.ru/');
    $r = curl_exec($c);
    curl_close($c);

    preg_match_all('/"post_hash":"(\w+)"/i', $r, $f1);
    preg_match_all('/"user_id":(\d+),/i', $r, $f2);
    preg_match_all('/handlePageParams\(\{"id":(\d+),/i', $r, $f3);
    return $f = array(
           'post_hash' => $f1[1][0],
           'user_id'   => $f2[1][0],
           'my_id'     => $f3[1][0]);
  }
{{< /highlight >}}

В результате мы получим массив с тремя переменными, которые необходимы нам для работы. Теперь осталось реализовать функцию создания сообщения ссылки. За публикацию сообщений на вашей стенке отвечает файл al_wall.php, который имеет множество получаемых параметров и в зависимости от каждого может создавать различные сообщения. Для нас наиболее важными будут следующие параметры:

-   `act` --- собственно action для данного php файла, мы передаем значение post
-   `hash` --- тот самый post_hash, который мы получили ранее
-   `message` --- наше сообщение, не длиннее 255 символов, иначе произойдет создание заметки
-   `note_title` --- название заметки, если выше вы превысили лимит символов
-   `status_export` --- параметр, определяющий «Экспорт в твиттер», если таковой аккаунт у вас связан с ВКонтакте
-   `to_id` --- id пользователя на чью стенку мы публикуем сообщение
-   `type` --- пока что обнаружены два возможных значения, all --- публикация на вашей стенке, feed --- публикации в вашем разделе Новости (блок «Что у вас нового») media_type --- тип сообщения, ставим share, чтобы получить ссылку
-   `url` --- передаваемый нами url ссылки
-   `title` --- название вашей ссылки, ограничение в 81 символ
-   `description` --- всплывающее описание ссылки, сюда можно передавать, например, первые строчки вашей новости, ограничение в 255 символов

На основе этих данных напишем функцию создания сообщения:

{{< highlight php >}}
function _status($cookies, $hash, $url, $message, $title, $descr, $id) {
    $u = urlencode($url);
    $m = urlencode($message);
    $t = urlencode($title);
    $d = urlencode($descr);
    $q = 'act=post&al=1&hash=' . $hash . '&message=' . $m . '&note_title=&official=&status_export=&to_id=' . $id . '&type=all&media_type=share&url=' . $u . '&title=' . $t . '&description=' . $d;
    $c = curl_init();
    curl_setopt($c, CURLOPT_HEADER, 0);
    curl_setopt($c, CURLOPT_HTTPHEADER, array('X-Requested-With: XMLHttpRequest'));
    curl_setopt($c, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($c, CURLOPT_POST, 1);
    curl_setopt($c, CURLOPT_REFERER, 'http://vkontakte.ru/id'.$id);
    curl_setopt($c, CURLOPT_FOLLOWLOCATION, 1);
    curl_setopt($c, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows; U; Windows NT 6.1; ru; rv:1.9.2.13) Gecko/20101203 Firefox/3.6.13');
    curl_setopt($c, CURLOPT_POSTFIELDS, $q);
    curl_setopt($c, CURLOPT_COOKIEJAR,  $cookies);
    curl_setopt($c, CURLOPT_COOKIEFILE, $cookies);
    curl_setopt($c, CURLOPT_TIMEOUT, 15);
    curl_setopt($c, CURLOPT_CONNECTTIMEOUT, 15);
    curl_setopt($c, CURLOPT_URL, 'http://vkontakte.ru/al_wall.php');
    $r = curl_exec($c);
    curl_close($c);

    return $r;
}
{{< /highlight >}}

Функция вернет нам ответ сервера ВКонтакте --- это будет либо текст ошибки, либо последние 10 сообщений со стенки, которые можно обработать по своему усмотрению. Собственно работа с сервером ВКонтакте закончена, осталось написать общую функцию, которая будет проверять авторизацию, получать переменные и создавать сообщение.

{{< highlight php >}}
function vkPost($url='http://habrahabr.ru/', $message='message', $title='title', $descr='descr')  {
    $o = 'aqwdhfyrfd.txt';
    $h = _params($o, 'http://vkontakte.ru/id1', true);

    if($h['my_id'] == 0) {
      _auth($o, $d, true);
      $h = _params($o, 'http://vkontakte.ru/id1', true);
    }

    if($h['my_id'] != 0) {
      $r = _status($o, $h['post_hash'], $url, $message, $title, $descr, $h['user_id']);
      $c = preg_match_all('/page_wall_count_all/smi',$r,$f);
      if( $c == 0 ) {
        return false;
      } else {
        return true;
      }
    }
}
{{< /highlight >}}


### Возможности интеграции

Теперь можно использовать ее где угодно, на любом движке. Или же создать отдельный php файл, через который публиковать любые ссылки со своим описанием у себя на стенке. В качестве примера я покажу интеграцию с движком Wordpress, где при публикации записи в блоге, вы автоматически опубликуете ссылку на нее. Итак, необходимо все вышеприведенные функции перенести в functions.php, который находится в каталоге с вашей темой, если его там нет, то создайте его. Затем в него же допишем следующую функцию и определим ее как хук:

{{< highlight php >}}
function wp_vk_post_add($post_ID) {
        $post  = get_post($post_ID);
        $title = $post->post_title;
        $link  = get_permalink($post_ID);
        $descr = $post->post_content;
  $vkont = get_post_meta($post_ID, 'vkontakte', true);

  if(mb_strlen(trim($descr), 'UTF-8') >= 250) {
          $descr = strip_tags($descr);
    $descr = mb_substr($descr,0,250, 'UTF-8').'...';
  }
  $message = 'Текст песни ' . $title;
  if(mb_strlen(trim($message), 'UTF-8') >= 250) {
    $message = mb_substr($message,0,250, 'UTF-8').'...';
  }
  if(mb_strlen(trim($title), 'UTF-8') >= 78) {
    $title = mb_substr($title,0,78, 'UTF-8').'...';
  }
  if($vkont != '1') {
          $status = vkPost($link, $message, $title, $descr);
    if($status) {
      update_post_meta($post_ID, 'vkontakte','1');
    } else {
      update_post_meta($post_ID, 'vkontakte','0');
    }
  }
        return $post_ID;
}
add_action('publish_post', 'wp_vk_post_add');
{{< /highlight >}}

Немного пояснений. Дело в том, что экшен publish_post в Вордпресс отрабатывается не только когда вы нажимаете кнопку Опубликовать в админке, но и при каждом сохранении записи. Получать каждый раз ссылку, когда вы редактируете свою запись после публикации, конечно же не комильфо. Поэтому при удачной публикации ссылки к нашему посту добавляется пользовательское поле vkontakte со значением 1, а перед публикацией проверяется ее наличие --- если оно существует и содержит 1, то функция vkPost пропускается.

### Заключение

Вот так мы получили возможность взаимодействовать с ВКонтакте и быть более интерактивными. Конечно же правильнее было бы оформить все служебные функции в отдельный класс, инициализацию curl объединить, а затем просто подключать этот класс в работе, но сделать это самому не сложно, а целью было показать каким образом это можно реализовать. Так же нужно помнить, что ВКонтакте вряд ли пропустит ваш запрос без использования прокси сервера. Позже можно добавить и вставку картинки в данную ссылку, но это уже история другого топика.

Стоит так же заметить, что `al_wals.php` запросит дополнительный параметр captcha, если ваш скрипт будет слишком усердно посылать статусы или вообще вернет «Ошибка доступа» --- поэтому в рассылке спама этот метод вряд ли вам поможет.

А вот и пример:

![](/img/posts/vk_integration_1.png)

>Это копия моей [оригинальной статьи](https://habr.com/ru/post/113968/), опубликованной на Хабре в 2011 году. Опубликована как есть, без изменений текста, поправлены только ссылки.