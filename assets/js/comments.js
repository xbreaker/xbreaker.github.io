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

    submitEvent.submitter.setAttribute("disabled", "disabled");
    form.classList.toggle("loading");
    notice.innerHTML = "Комментарий отправляется";
    notice.classList.add("sending");
    xhr.addEventListener("load", e => {
        form.classList.toggle("loading");
        notice.innerHTML = "Комментарий отправлен успешно";
        notice.classList.remove("sending");
        notice.classList.add("success");
        submitEvent.submitter.removeAttribute("disabled");
        form.reset();
    });
    xhr.addEventListener("error", e => {
        form.classList.toggle("loading"); 
        notice.innerHTML = "Ошибка отправки комментария";
        notice.classList.remove("sending");
        notice.classList.add("error");
        submitEvent.submitter.removeAttribute("disabled");
    });
    xhr.open("POST", form.action);
    xhr.send(fd);
});