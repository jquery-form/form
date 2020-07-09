'use strict';

module.exports = function(grunt) {
	grunt.initConfig({
		eslint : {
			options : {
				quiet : true
			},
			target : ['src/**/*.js']
		},

		githooks : {
			all : {
				'pre-commit' : 'pre-commit'
			},
			options : {
				endMarker   : '# GRUNT-GITHOOKS END',
				hashbang    : '#!/bin/sh',
				startMarker : '# GRUNT-GITHOOKS START',
				template    : 'install/template/shell.hb'
			}
		},

		meta : {
			banner : '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd HH:MM:ss") %> */'
		},

		mocha : {
			all : {
				src : ['test/*.html']
			},
			options : {
				growlOnSuccess : false,
				run            : true
			}
		},

		pkg : grunt.file.readJSON('package.json'),

		// Minifies JS files
		uglify : {
			dist : {
				files : [{
					cwd    :	'src',
					dest   :	'dist',
					expand :	true,
					ext    :	'.min.js',
					extDot :	'last',
					src    :	['*.js', '!*.min.js']
				}]
			},
			options : {
				footer : '\n',
				output : {
					comments : /^!|@preserve|@license|@cc_on/i
				},
				sourceMap : true
			}
		}
	});

	// Load tasks
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-mocha');
	grunt.loadNpmTasks('grunt-eslint');
	grunt.loadNpmTasks('grunt-githooks');

	// Default task.
	grunt.registerTask('lint', ['eslint']);
	grunt.registerTask('test', ['lint', 'mocha']);
	grunt.registerTask('pre-commit', ['test']);
	grunt.registerTask('default', ['test', 'uglify']);
};
