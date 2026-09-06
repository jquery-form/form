# jQuery Form [![Build Status](https://travis-ci.org/jquery-form/form.svg?branch=master)](https://travis-ci.org/jquery-form/form)

## Overview
The jQuery Form Plugin allows you to easily and unobtrusively upgrade HTML forms to use AJAX. The main methods, ajaxForm and ajaxSubmit, gather information from the form element to determine how to manage the submit process. Both of these methods support numerous options which allow you to have full control over how the data is submitted.

No special markup is needed, just a normal form. Submitting a form with AJAX doesn't get any easier than this!

## Community
Want to contribute to jQuery Form? Awesome! See [CONTRIBUTING](CONTRIBUTING.md) for more information.

### Code of Conduct
Please note that this project is released with a [Contributor Code of Conduct](CODE_OF_CONDUCT.md) to ensure that this project is a welcoming place for **everyone** to contribute to. By participating in this project you agree to abide by its terms.

### Pull Requests Needed
#### Enhancements needed to to be fully compatible with jQuery 3
jQuery 3 is removing a lot of features that have been deprecated for a long time. Some of these are still in use by jQuery Form.  
Pull requests and assistance in updating jQuery Form to be compatible with jQuery 3 are greatly appreciated.  
See [issue #544](https://github.com/jquery-form/form/issues/544) for more information.

## Compatibility
* Requires jQuery 1.7.2 or later.  
* Compatible with jQuery 2.
* Partially compatible with jQuery 3.
* **Not** compatible with jQuery 3 Slim. ([issue #544](https://github.com/jquery-form/form/issues/544))

## Download
* **Development:** [src/jquery.form.js
](https://github.com/jquery-form/form/blob/master/src/jquery.form.js)
* **Production/Minified:** [dist/jquery.form.min.js
](https://github.com/jquery-form/form/blob/master/dist/jquery.form.min.js)

### CDN
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery.form/4.3.0/jquery.form.min.js" integrity="sha384-qlmct0AOBiA2VPZkMY3+2WqkHtIQ9lSdAsAn5RUJD/3vA5MKDgSGcdmIv4ycVxyn" crossorigin="anonymous"></script>
```
or
```html
<script src="https://cdn.jsdelivr.net/gh/jquery-form/form@4.3.0/dist/jquery.form.min.js" integrity="sha384-qlmct0AOBiA2VPZkMY3+2WqkHtIQ9lSdAsAn5RUJD/3vA5MKDgSGcdmIv4ycVxyn" crossorigin="anonymous"></script>
```

---

## API

### jqXHR
The jqXHR object is stored in element <em>data</em>-cache with the <code>jqxhr</code> key after each <code>ajaxSubmit</code>
call. It can be accessed like this:

````javascript
var form = $('#myForm').ajaxSubmit({ /* options */ });
var xhr = form.data('jqxhr');

xhr.done(function() {
...
});
````

### ajaxForm( options )
Prepares a form to be submitted via AJAX by adding all of the necessary event listeners. It does **not** submit the form. Use `ajaxForm` in your document's `ready` function to prepare existing forms for AJAX submission, or with the `delegation` option to handle forms not yet added to the DOM.  
Use ajaxForm when you want the plugin to manage all the event binding for you.

````javascript
// prepare all forms for ajax submission
$('form').ajaxForm({
    target: '#myResultsDiv'
});
````

### ajaxSubmit( options )
Immediately submits the form via AJAX. In the most common use case this is invoked in response to the user clicking a submit button on the form.
Use ajaxSubmit if you want to bind your own submit handler to the form.

````javascript
// bind submit handler to form
$('form').on('submit', function(e) {
    e.preventDefault(); // prevent native submit
    $(this).ajaxSubmit({
        target: '#myResultsDiv'
    })
});
````

---

## Options
**Note:** All standard [$.ajax](http://api.jquery.com/jQuery.ajax) options can be used.

### beforeSerialize
Callback function invoked before form serialization. Provides an opportunity to manipulate the form before its values are retrieved. Returning `false` from the callback will prevent the form from being submitted. The callback is invoked with two arguments: the jQuery wrapped form object and the options object.

````javascript
beforeSerialize: function($form, options) {
    // return false to cancel submit
}
````

### beforeSubmit
Callback function invoked before form submission. Returning `false` from the callback will prevent the form from being submitted. The callback is invoked with three arguments: the form data in array format, the jQuery wrapped form object, and the options object.

````javascript
beforeSubmit: function(arr, $form, options) {
    // form data array is an array of objects with name and value properties
    // [ { name: 'username', value: 'jresig' }, { name: 'password', value: 'secret' } ]
    // return false to cancel submit
}
````

### beforeFormUnbind
Callback function invoked before form events unbind and bind again. Provides an opportunity to manipulate the form before events will be remounted. The callback is invoked with two arguments: the jQuery wrapped form object and the options object.

````javascript
beforeFormUnbind: function($form, options) {
    // your callback code
}
````

### filtering
Callback function invoked before processing fields. This provides a way to filter elements.

````javascript
filtering: function(el, index) {
    if ( !$(el).hasClass('ignore') ) {
        return el;
    }
}
````

### clearForm
Boolean flag indicating whether the form should be cleared if the submit is successful

### data
An object containing extra data that should be submitted along with the form.

````
data: { key1: 'value1', key2: 'value2' }
````

### dataType
Expected data type of the response. One of: null, 'xml', 'script', or 'json'. The dataType option provides a means for specifying how the server response should be handled. This maps directly to jQuery's dataType method. The following values are supported:

* 'xml': server response is treated as XML and the 'success' callback method, if specified, will be passed the responseXML value
* 'json': server response will be evaluated and passed to the 'success' callback, if specified
* 'script': server response is evaluated in the global context

### delegation
true to enable support for event delegation
*requires jQuery v1.7+*

````javascript
// prepare all existing and future forms for ajax submission
$('form').ajaxForm({
    delegation: true
});
````

### error
**Deprecated**  
Callback function to be invoked upon error.

### forceSync
Only applicable when explicity using the iframe option or when uploading files on browsers that don't support XHR2.
Set to `true` to remove the short delay before posting form when uploading files. The delay is used to allow the browser to render DOM updates before performing a native form submit. This improves usability when displaying notifications to the user, such as "Please Wait..."

### iframe
Boolean flag indicating whether the form should *always* target the server response to an iframe instead of leveraging XHR when possible.

### iframeSrc
String value that should be used for the iframe's src attribute when an iframe is used.

### iframeTarget
Identifies the iframe element to be used as the response target for file uploads. By default, the plugin will create a temporary iframe element to capture the response when uploading files. This option allows you to use an existing iframe if you wish. When using this option the plugin will not attempt handling the response from the server.

### method
The HTTP method to use for the request (e.g. 'POST', 'GET', 'PUT').

### replaceTarget
Optionally used along with the target option. Set to true if the target should be replaced or false if only the target contents should be replaced.

### resetForm
Boolean flag indicating whether the form should be reset if the submit is successful

### semantic
Boolean flag indicating whether data must be submitted in strict semantic order (slower). Note that the normal form serialization is done in semantic order except for input elements of `type="image"`. You should only set the semantic option to true if your server has strict semantic requirements and your form contains an input element of `type="image"`.

### success
**Deprecated**  
Callback function to be invoked after the form has been submitted. If a 'success' callback function is provided it is invoked after the response has been returned from the server. It is passed the following standard jQuery arguments:

1. `data`, formatted according to the dataType parameter or the dataFilter callback function, if specified
2. `textStatus`, string
3. `jqXHR`, object
4. `$form` jQuery object containing form element

### target
Identifies the element(s) in the page to be updated with the server response. This value may be specified as a jQuery selection string, a jQuery object, or a DOM element.

### type
The HTTP method to use for the request (e.g. 'POST', 'GET', 'PUT').  
An alias for `method` option. Overridden by the `method` value if both are present.

### uploadProgress
Callback function to be invoked with upload progress information (if supported by the browser). The callback is passed the following arguments:

1. event; the browser event
2. position (integer)
3. total (integer)
4. percentComplete (integer)

### url
URL to which the form data will be submitted.

---

## Utility Methods
### formSerialize
Serializes the form into a query string. This method will return a string in the format: `name1=value1&name2=value2`

````javascript
var queryString = $('#myFormId').formSerialize();
````

### fieldSerialize
Serializes field elements into a query string. This is handy when you need to serialize only part of a form. This method will return a string in the format: `name1=value1&name2=value2`

````javascript
var queryString = $('#myFormId .specialFields').fieldSerialize();
````

### fieldValue
Returns the value(s) of the element(s) in the matched set in an array. This method always returns an array. If no valid value can be determined the array will be empty, otherwise it will contain one or more values.

### resetForm
Resets the form to its original state by invoking the form element's native DOM method.

### clearForm
Clears the form elements. This method empties all of the text inputs, password inputs and textarea elements, clears the selection in any select elements, and unchecks all radio and checkbox inputs. It does *not* clear hidden field values.

### clearFields
Clears selected field elements. This is handy when you need to clear only a part of the form.

---

## File Uploads
The Form Plugin supports the use of [XMLHttpRequest Level 2]("http://www.w3.org/TR/XMLHttpRequest/") and [FormData](https://developer.mozilla.org/en/XMLHttpRequest/FormData) objects on browsers that support these features. As of today (March 2012) that includes Chrome, Safari, and Firefox. On these browsers (and future Opera and IE10) files uploads will occur seamlessly through the XHR object and progress updates are available as the upload proceeds. For older browsers, a fallback technology is used which involves iframes. [More Info](http://malsup.com/jquery/form/#file-upload)

---

## Contributors
This project has transferred from [github.com/malsup/form](https://github.com/malsup/form/), courtesy of [Mike Alsup](https://github.com/malsup).  
See [CONTRIBUTORS](CONTRIBUTORS.md) for details.

## License

This project is dual-licensed under the LGPLv2.1 (or later) or MIT licenses:

* [GNU Lesser General Public License v2.1](LICENSE)
* [MIT](LICENSE-MIT)

---

Additional documentation and examples for version 3.51- at: [http://malsup.com/jquery/form/](http://malsup.com/jquery/form/)


## 🌐 Web Resources & Interactive Index
- [TERMS](https://themindplay.github.io/terms.html)
- [PURRFECT SCOOPS](https://learnaction.netlify.app/purrfect-scoops.html)
- [2048 MERGE WORLD](https://learnaction.netlify.app/2048-merge-world.html)
- [BUILD YOUR AQUARIUM](https://learnaction.netlify.app/build-your-aquarium.html)
- [MY HOSPITAL LEARN CARE](https://learnaction.netlify.app/my-hospital-learn-care.html)
- [WORLDGUESSR](https://learnaction.onrender.com/worldguessr.html)
- [CAPYBARA COIN MASTER](https://learnaction.netlify.app/capybara-coin-master.html)
- [PIZZA MAKER COOKING GAMES FOR KIDS](https://learnaction.netlify.app/pizza-maker-cooking-games-for-kids.html)
- [GOD OF LIGHT](https://learnaction.netlify.app/god-of-light.html)
- [JELLY BLOCK PUZZLE](https://learnaction.netlify.app/jelly-block-puzzle.html)
- [SHEEP SORT PUZZLE SORT COLOR](https://learnaction.netlify.app/sheep-sort-puzzle-sort-color.html)
- [CATEGORY THINKY 2](https://learnaction.netlify.app/category-thinky-2.html)
- [HOME RUSH THE FISH WAR](https://learnaction.netlify.app/home-rush-the-fish-war.html)
- [DREAM MANIA HAPPY MATCH](https://learnaction.netlify.app/dream-mania-happy-match.html)
- [SCARY BABY YELLOW GAME](https://learnaction.netlify.app/scary-baby-yellow-game.html)
- [BASKET CHAMPS](https://learnaction.netlify.app/basket-champs.html)
- [PUZZLE BLOCKS](https://learnaction.netlify.app/puzzle-blocks.html)
- [AUTHENTIC FOOTBALL](https://learnaction.netlify.app/authentic-football.html)
- [MATH STARS](https://learnaction.netlify.app/math-stars.html)
- [IDLE FOOTBALL MANAGER](https://learnaction.netlify.app/idle-football-manager.html)
- [KOKO LOCO BLOCK BLAST](https://learnaction.netlify.app/koko-loco-block-blast.html)
- [SITEMAP](https://thelearnquester.web.app/sitemap.html)
- [PRIVACY](https://themindzone.pages.dev/privacy.html)
- [CRUSH IT ALL](https://learnaction.netlify.app/crush-it-all.html)
- [ONLINE PORTAL](https://cryptotify.github.io/)
- [CELEBRITY SPRING FASHION TRENDS](https://learnaction.netlify.app/celebrity-spring-fashion-trends.html)
- [CATEGORY CAT](https://learnaction.netlify.app/category-cat.html)
- [CATEGORY COOKING](https://learnaction.netlify.app/category-cooking.html)
- [OFF ROAD OVERDRIVE](https://learnaction.netlify.app/off-road-overdrive.html)
- [CATEGORY SANDBOX40](https://learnaction.netlify.app/category-sandbox40.html)
- [TYPING ADVENTURE](https://learnaction.netlify.app/typing-adventure.html)
- [CATEGORY HORROR](https://learnaction.netlify.app/category-horror.html)
- [SITEMAP](https://brainquests-fb2c5.web.app/sitemap.html)
- [CATEGORY FARMING](https://learnaction.netlify.app/category-farming.html)
- [MINE SLASH](https://learnaction.netlify.app/mine-slash.html)
- [BUS COLOR JAM](https://learnaction.netlify.app/bus-color-jam.html)
- [GET TO THE CHOPPER](https://learnaction.netlify.app/get-to-the-chopper.html)
- [UNICORN FIND THE DIFFERENCES](https://learnaction.netlify.app/unicorn-find-the-differences.html)
- [MAHJONG CLASSIC](https://learnaction.netlify.app/mahjong-classic.html)
- [SEAT JAM 3D](https://learnaction.netlify.app/seat-jam-3d.html)
- [PRIVACY](https://themindplay.pages.dev/privacy.html)
- [TANKS RACE FOR SURVIVAL](https://learnaction.netlify.app/tanks-race-for-survival.html)
- [MASTER BLENDER](https://learnaction.netlify.app/master-blender.html)
- [CATEGORY CAR376](https://learnaction.netlify.app/category-car376.html)
- [SUMMER RIDER 3D](https://learnaction.netlify.app/summer-rider-3d.html)
- [SITEMAP](https://skillplay.github.io/sitemap.html)
- [SKATING PARK](https://learnaction.netlify.app/skating-park.html)
- [OBBY 3D SPRUNKI PARKOUR](https://learnaction.netlify.app/obby-3d-sprunki-parkour.html)
- [ONLINE PORTAL](https://themindskillplayplay.pages.dev/)
- [SITEMAP](https://cryptotify.github.io/sitemap.html)
- [CATEGORY BUILDING182](https://learnaction.netlify.app/category-building182.html)
- [CATEGORY SKILL256](https://learnaction.onrender.com/category-skill256.html)
- [WILD WEST MATCH](https://learnaction.onrender.com/wild-west-match.html)
- [STICKMAN DISMOUNT SIMULATOR](https://learnaction.onrender.com/stickman-dismount-simulator.html)
- [ONLINE PORTAL](https://themindplays.pages.dev/)
- [MERGE LAGOON](https://learnaction.netlify.app/merge-lagoon.html)
- [ASMR WASHING FIXING](https://learnaction.onrender.com/asmr-washing-fixing.html)
- [CATEGORY AGILITY](https://learnaction.netlify.app/category-agility.html)
- [CATEGORY MOUSE](https://learnaction.netlify.app/category-mouse.html)
- [CATEGORY DRESS UP](https://learnaction.netlify.app/category-dress-up.html)
- [TERMS](https://studyplaying.github.io/terms.html)
- [MACHINE CITY BALLS](https://learnaction.netlify.app/machine-city-balls.html)
- [SCOOP TOWER](https://learnaction.netlify.app/scoop-tower.html)
- [WACKY WHEELS](https://learnaction.netlify.app/wacky-wheels.html)
- [THE SPECIMEN ZERO](https://learnaction.onrender.com/the-specimen-zero.html)
- [ROCK CRAWLING](https://learnaction.onrender.com/rock-crawling.html)
- [CATEGORY IDLE CLICKER GAME](https://learnaction.onrender.com/category-idle-clicker-game.html)
- [CATEGORY TOP DOWN251](https://learnaction.onrender.com/category-top-down251.html)
- [INDEX14](https://learnaction.netlify.app/index14.html)
- [CATEGORY LOGIC538](https://learnaction.onrender.com/category-logic538.html)
- [SAVE THE BEAUTY](https://learnaction.onrender.com/save-the-beauty.html)
- [NINE CARDS OF WINTER](https://learnaction.netlify.app/nine-cards-of-winter.html)
- [TOWER DEFENSE DRAGON MERGE](https://learnaction.netlify.app/tower-defense-dragon-merge.html)
- [TWO DOTS REMASTERED](https://learnaction.netlify.app/two-dots-remastered.html)
- [HIDDEN OBJECT CLUES AND MYSTERIES](https://learnaction.onrender.com/hidden-object-clues-and-mysteries.html)
- [TERMS](https://themindskillplayplay.pages.dev/terms.html)
- [ONLINE PORTAL](https://brainquests.github.io/)
- [MONSTER ESCAPE](https://learnaction.onrender.com/monster-escape.html)
- [PRIVACY](https://iskillplay.web.app/privacy.html)
- [PRIVACY](https://cryptotify.github.io/privacy.html)
- [SITEMAP](https://themindplay.github.io/sitemap.html)
- [TAILOR STYLIST FASHION DIARY](https://learnaction.onrender.com/tailor-stylist-fashion-diary.html)
- [GEOMETRY RUSH](https://learnaction.netlify.app/geometry-rush.html)
- [CATEGORY ZOMBIE175](https://learnaction.onrender.com/category-zombie175.html)
- [ANTS PARTY](https://learnaction.onrender.com/ants-party.html)
- [TERMS](https://iskillquest.pages.dev/terms.html)
- [CATEGORY ARMY40](https://learnaction.netlify.app/category-army40.html)
- [YOUR DREAM ROOM](https://learnaction.onrender.com/your-dream-room.html)
- [CATEGORY BALL173](https://learnaction.netlify.app/category-ball173.html)
- [TERMS](https://iskillplay.web.app/terms.html)
- [FIX THE HOOF](https://learnaction.onrender.com/fix-the-hoof.html)
- [CATEGORY JIGSAW](https://learnaction.netlify.app/category-jigsaw.html)
- [CATEGORY ARCHERY52](https://learnaction.netlify.app/category-archery52.html)
- [PRIVACY](https://learnquesters.pages.dev/privacy.html)
- [GRENADE SIMULATOR](https://learnaction.netlify.app/grenade-simulator.html)
- [CATEGORY POOL 2](https://learnaction.onrender.com/category-pool-2.html)
- [CATEGORY CAN T STOP PLAYING212](https://learnaction.netlify.app/category-can-t-stop-playing212.html)
- [TERMS](https://skillcrafts.github.io/terms.html)
- [CATEGORY BATTLE CATEGORY](https://learnaction.netlify.app/category-battle-category.html)
- [SKIP LOVE](https://learnaction.onrender.com/skip-love.html)
- [BUBBLE SHOOTER LEGEND](https://learnaction.onrender.com/bubble-shooter-legend.html)
- [HIDDEN OBJECTS LOST ISLAND 2](https://learnaction.netlify.app/hidden-objects-lost-island-2.html)
- [NINJA OBBY PARKOUR](https://learnaction.netlify.app/ninja-obby-parkour.html)
- [ARENA](https://learnaction.onrender.com/arena.html)
- [CATEGORY PLATFORM](https://learnaction.onrender.com/category-platform.html)
- [TIC TAC TOE MATCH THREE](https://learnaction.netlify.app/tic-tac-toe-match-three.html)
- [DRILL QUEST](https://learnaction.netlify.app/drill-quest.html)
- [THROUGH THE WALL 3D](https://learnaction.onrender.com/through-the-wall-3d.html)
- [BRAWLER MAN FIST OF FURY](https://learnaction.netlify.app/brawler-man-fist-of-fury.html)
- [INDEX4](https://learnaction.netlify.app/index4.html)
- [BLOCK MINE FUSE TNT](https://learnaction.netlify.app/block-mine-fuse-tnt.html)
- [MAHJONG GARDEN](https://learnaction.netlify.app/mahjong-garden.html)
- [PRIVACY](https://learnquester.pages.dev/privacy.html)
- [LIPSTICK COLLECTOR RUN](https://learnaction.onrender.com/lipstick-collector-run.html)
- [COOKING WORLD REBORN](https://learnaction.netlify.app/cooking-world-reborn.html)
- [AUTOGUN HEROES IZK](https://learnaction.onrender.com/autogun-heroes-izk.html)
- [FISH LOVE PINS](https://learnaction.onrender.com/fish-love-pins.html)
- [CATEGORY MAHJONG](https://learnaction.onrender.com/category-mahjong.html)
- [GIANT SUSHI MERGE MASTER GAME](https://learnaction.onrender.com/giant-sushi-merge-master-game.html)
- [CATEGORY CUTE](https://learnaction.netlify.app/category-cute.html)
- [CATEGORY SIMULATION](https://learnaction.netlify.app/category-simulation.html)
- [CATEGORY RELAXING223](https://learnaction.netlify.app/category-relaxing223.html)
- [PARKING FURY 3D NIGHT CITY](https://learnaction.onrender.com/parking-fury-3d-night-city.html)
- [CHAMPIONS FC](https://learnaction.onrender.com/champions-fc.html)
- [CINEMA EMPIRE IDLE TYCOON](https://learnaction.onrender.com/cinema-empire-idle-tycoon.html)
- [ZIP ZAP](https://learnaction.netlify.app/zip-zap.html)
- [BLOCK MATCH 8X8](https://learnaction.onrender.com/block-match-8x8.html)
- [CHROME CARS GARAGE](https://learnaction.netlify.app/chrome-cars-garage.html)
- [CATEGORY DRAGON22](https://learnaction.netlify.app/category-dragon22.html)
- [2 3 4 PLAYER GAMES](https://learnaction.onrender.com/2-3-4-player-games.html)
