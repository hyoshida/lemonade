require 'bundler'
Bundler.require

desc 'Build our app to build.js'
task :build do
  env = Opal::Environment.new
  env.append_path 'app'

  File.open('public/build.js', 'w+') do |out|
    out << env['lemonade'].to_s
    out << env['application.lem'].to_s
  end
end
