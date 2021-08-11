document.addEventListener(
      "click",
      function(event) {
          const target = event.target,
              I = function(id) {
                  return document.getElementById(id);
              },
              C = function(cl) {
                  return document.getElementsByClassName(cl)[0];
              };
          if (target.matches("[data-toggle='reply-form']")) {
              var cancel = I("cancel-button"),
                  comment = target.parentNode.parentNode,
                  author = comment.getAttribute("data-name");
              target.parentNode.appendChild(I("reply-form"));
              target.classList.toggle("d-none");
              I("input-thread").value = comment.getAttribute("data-thread");
              I("input-parent").value = comment.getAttribute("data-id");
              I("input-parentName").value = author;
              I("reply-form-head").innerHTML = "Ваш ответ " + author;

              if(cancel.classList.contains("d-none"))
                cancel.classList.toggle("d-none");
          }
          if (target.matches("[data-toggle='reply-form-cancel']")) {
              I("reply-form-head").innerHTML = "Добавить комментарий";
              C("d-none").classList.toggle("d-none");
              I("cancel-button").classList.toggle("d-none");
              I("comment-thread").appendChild(I("reply-form"));
          }
      },
      false
  );

const form = document.querySelector("#reply-form");
form.addEventListener("submit", submitEvent => {
    submitEvent.preventDefault();

    const notice = document.getElementById("notice");
    const fd = new FormData(form);  
    const xhr = new XMLHttpRequest();

    const json = {}
    fd.forEach(function(value, prop){
      json[prop] = value
    })

    // convert json to urlencoded query string
    // SOURCE: https://stackoverflow.com/a/37562814 (comments)
    const formBody = Object.keys(json).map(key => encodeURIComponent(key) + '=' + encodeURIComponent(json[key])).join('&')

    submitEvent.submitter.setAttribute("disabled", "disabled");
    form.classList.toggle("loading");
    notice.innerHTML = "Комментарий отправляется";
    notice.classList.add("sending");
    xhr.open("POST", form.action);
    xhr.onreadystatechange = function (event) {
        if (xhr.readyState == 4) {
            if(xhr.status == 200) {
                form.classList.toggle("loading");
                notice.innerHTML = "Комментарий отправлен успешно";
                notice.classList.remove("error");
                notice.classList.remove("sending");
                notice.classList.add("success");
                submitEvent.submitter.removeAttribute("disabled");
                form.reset();
            } else {
                let response = JSON.parse(xhr.responseText)
                form.classList.toggle("loading"); 
                if(response && response.errorCode === 'RECAPTCHA_INVALID_INPUT_RESPONSE') {
                    notice.innerHTML = "Ошибка отправки комментария (reCaptcha не пройдена)";
                } else {
                    notice.innerHTML = "Ошибка отправки комментария";
                }
                notice.classList.remove("success");
                notice.classList.remove("sending");
                notice.classList.add("error");
                submitEvent.submitter.removeAttribute("disabled");
            }
        }
    };
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    xhr.send(formBody);
});