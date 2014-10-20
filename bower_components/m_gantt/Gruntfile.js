module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		uglify: {
			options: {
				banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n',
				sourceMap: true
			},
			build: {
				src: 'dist/<%= pkg.name %>.js',
				dest: 'dist/<%= pkg.name %>.min.js'
			}
		},
		copy: {
		  main: {
			// files: [
			//   {
			// 	expand: true, 
			// 	// flatten: true,
			// 	// cwd: 'scr/',
			// 	src: ['src/**/*'], 
			// 	dest: 'dist2/'
			//   }
			// ],
		  },
		},
		watch: {
			scripts: {
				files: ['dist/**/*', 'demos/**/*'],
				tasks: [],
				options: {
					spawn: false,
					livereload: true
				},
			},
		},
		open : {
			dev : {
				path: 'http://localhost:8000/demos/demo.html',
				app: 'Google Chrome'
			},
		},
		connect: {
			server: {
				options: {
					livereload: true,
					port: 8000,
					hostname: '*',
					// middleware: function (connect, options) {
					// 	return [
					// 		// Inject a livereloading script into static files.
					// 		require('connect-livereload')({  }),
					// 		// Serve static files.
					// 		connect.static(options.base),
					// 		// Make empty directories browsable.
					// 		connect.directory(options.base)
					// 	];
					// },
					// onCreateServer: function(server, connect, options) {
					// }
				}
			}
		}

	});


	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-contrib-connect');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-open');

	// Default task(s).
	grunt.registerTask('default', ['connect', 'open', 'watch']);
	grunt.registerTask('compile', ['uglify', 'copy']);

};
