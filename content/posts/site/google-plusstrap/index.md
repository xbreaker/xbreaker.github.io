---
title: "Что если бы Google выпустил свой Bootstrap?"
description: "Превращаем популярный CSS-фреймворк Twitter Bootstrap в его брата-близнеца Google Plusstrap"
summary: "Мой экспериментальный проект по созданию своего CSS-фреймворка на основе стилей Google --- Plusstrap."
date: 2012-08-10T12:52:02+03:00
draft: false
tags: ["github", "plusstrap", "bootstrap", "google", "css", "habr"]
cover:
    image: images/plusstrap_0.png
showtoc: false
slug: "google-plusstrap"
---

>Это копия моей [оригинальной статьи](https://habr.com/ru/post/149373/), опубликованной на Хабре в 2012 году. Опубликована как есть, без изменений текста, поправлены только ссылки.
>Сам фреймворк в итоге не получил развития и давно убран в [архив](https://github.com/xbreaker/plusstrap).

Поздравляю всех с пятницей и в качестве небольшого развлечения предлагаю представить, как бы выглядел популярный CSS-фреймворк [Twitter Bootstrap](https://getbootstrap.com/), если бы он был от Google? Встречайте [Plusstrap](https://aybe.org/plusstrap/).

### Plusstrap

Итак, потратив два дня на изучение особенностей оформления сервисов Google и, в частности, Google Plus, я решил попробовать переделать основные элементы Bootstrap и начал конечно же со строки поиска (здесь и далее Plusstrap будет расположен справа):

{{< figure src="images/plusstrap_1.png" caption="Строка поиска" >}}

Затем переделал все кнопки, тут стоить заметить, что варианты кнопок Info, Warning и Inverse я не нашел у Гугла, поэтому пришлось немного фантазировать:

{{< figure src="images/plusstrap_2.png" caption="Кнопки" >}}

Сразу прошу прощения, если сглаживание моего компьютера кому-нибудь сильно режет глаза :). А тем временем переделал таблицы (спасибо Google Docs), модальные окна и прогресс бары:

{{< figure src="images/plusstrap_3.png" caption="Прогресс бары" >}}

Последним я поправил то, что касается всплывающих подсказок и прочих мелочей, вроде закругления углов блоков у тега code и оформления tab-навигации (спасибо Google Mail):

{{< figure src="images/plusstrap_4.png" caption="Всплывающие подсказки" >}}

Вот таким вышел мой пятничный эксперимент. Все желающие могут посмотреть полную версию на [Github](https://aybe.org/plusstrap/), только хочу заметить, что less-версии и возможности сбора css на лету вы не обнаружите. Однако, если идея понравится, то позже постараюсь добавить less и кастомизацию скачиваемого css.

Готов выслушать любые предложения и замечания, только об ошибках в топике просьба писать в личку.

### Из любопытного

- Google практически не использует псевдо-классы типа focus и active, вместо этого к классам нужно элемента добавляются необходимые классы (например, `.doc-list-hov`);
- Так же Google практически для всего использует div блоки — для отрисовки кнопок, чекбоксов и прочих готовых элементов;
- В Google Docs используется готовый css-файл, в то время как в GMail и Google Plus весь css идет внутри html кода и собирается на лету;
- В Google очень любят короткие и регистрозависимые названия классов, например, `.cm` и `.cM` — разные классы, а так же использовать каждый класс для пары параметров, чтобы потом для нужного элемента собирать стиль из нескольких классов: ;
- Практически вся верстка резиновая, а расположение всех всплывающих элементов и тех, которые расположены нестандартно, задано в абсолютных значения top и left (right).

Всем отличных выходных! Еще раз ссылка на [Github](https://aybe.org/plusstrap/).

Новости по поводу выхода новых версий, а также пожелания можно оставить на странице [ВКонтакте](http://vk.com/plusstrap).