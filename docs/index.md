---
---

## Getting Started
### Overview
The jQuery Form Plugin allows you to easily and unobtrusively upgrade HTML forms to use AJAX. The main methods, `ajaxForm` and `ajaxSubmit`, gather information from the form element to determine how to manage the submit process. Both of these methods support numerous options which allows you to have full control over how the data is submitted. Submitting a form with AJAX doesn't get any easier than this!

### Quick Start Guide
1. Add a form to your page. Just a normal form, no special markup required:
    ```html
    <form id="myForm" action="comment.php" method="post">
      Name: <input type="text" name="name">
      Comment: <textarea name="comment"></textarea>
      <input type="submit" value="Submit Comment">
    </form>
    ```
2. Include jQuery and the Form Plugin external script files and a short script to initialize the form when the DOM is ready:
    ```html
    <html>
    <head>
      <script src="https://code.jquery.com/jquery-1.12.4.min.js" integrity="sha256-ZosEbRLbNQzLpnKIkEdrPv7lOy9C27hHQ+Xp8a4MxAQ=" crossorigin="anonymous"></script>
      <script src="http://malsup.github.com/jquery.form.js"></script>

      <script>
        // wait for the DOM to be loaded
        $(document).ready(function() {
          // bind 'myForm' and provide a simple callback function
          $('#myForm').ajaxForm(function() {
              alert("Thank you for your comment!");
          });
        });
      </script>
    </head>
    ```

**That's it!**

When this form is submitted the _name_ and _comment_ fields will be posted to _comment.php_. If the server returns a success status then the user will see a "Thank you" message.

*[AJAX]: Asynchronous JavaScript and XML
