module.exports = function(grunt) {
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		meta: {
			banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd HH:MM:ss") %> */'
		},

		mocha: {
			all: {
				src: ['test/**/*.html'],
			},
			options: {
				run: true
			}
		},

		// Minifies JS files
		uglify: {
			options: {
				preserveComments: /^!|@preserve|@license|@cc_on/i
			},
			dist: {
				files: [{
					expand:	true,
					cwd:	'src',
					src:	['*.js','!*.min.js'],
					dest:	'dist',
					ext:	'.min.js',
					extDot:	'last'
				}]
			}
		}
	});

	// Load tasks
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-mocha');

	// Default task.
	grunt.registerTask('test', [ 'mocha' ]);
	grunt.registerTask('default', [ 'test', 'uglify' ]);
};
