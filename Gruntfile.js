/*global module:false*/
module.exports = function(grunt) {
    "use strict";

    // Project configuration.
    grunt.initConfig({

        plugin: {
            file: 'jquery.form.js'
        },

        uglify: {
            core: {
                options: {
                    banner: '/*\n* jQuery Form Plugin; v<%= grunt.template.today("yyyymmdd") %>\n' +
                        '* http://jquery.malsup.com/form/\n' +
                    '* Copyright (c) <%= grunt.template.today("yyyy") %> M. Alsup; Dual licensed: MIT/GPL\n' +
                    '* https://github.com/malsup/form#copyright-and-license\n' +
                    '*/\n;'
                },
                files: {
                    'jquery.form.min.js': [ '<%= plugin.file %>' ]
                }
            }
        },

        jshint: {
            files: [ '<%= plugin.file %>' ],
            options: {
                curly: true
            }
        },

        watch: {
            files: [ '<%= plugin.file %>' ],
            tasks: 'jshint'
        }

    });

    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-watch');

    grunt.registerTask('default', [ 'jshint', 'uglify' ]);
};
