# Migrating from 4.x to 5.0

This guide is for people who use jquery-form 4.x and are moving to 5.0. 5.0 has breaking changes.

4.x stays available (`npm install jquery-form@4`, dist-tag `v4`) and gets security fixes. To see warnings for most of the removed features, turn on `$.fn.ajaxSubmit.debug = true` on the latest 4.x and run your code. Feedback goes to https://github.com/jquery-form/form/issues/629.

## Summary

| Change | Who is affected | 4.x warning |
| ------ | --------------- | ----------- |

Entries are added as each 5.0 change lands.

## Changes

## What your server receives

This section will hold before and after request bodies for the serialization changes.
