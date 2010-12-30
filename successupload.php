<?php

$request = array(
    'files' => $_FILES,
    'post' => $_POST,
    'get' => $_GET
);
echo json_encode($request);
