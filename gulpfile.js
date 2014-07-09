/* buildfile for jquery.form plugin */
var gulp = require('gulp'),
  concat = require('gulp-concat'),
  jshint = require('gulp-jshint'),
  uglify = require('gulp-uglify');

gulp.task('default', function() {
  gulp.src(['jquery.form.js'])
    .pipe(jshint())
    .pipe(jshint.reporter('default'))
    .pipe(uglify({ preserveComments: 'some' }))
    .pipe(concat('jquery.form.min.js'))
    .pipe(gulp.dest('.'));
});

gulp.task('watch', function () {
  gulp.watch('jquery.form.js', ['default']);
});
