class JavascriptImporter
  def initialize(javascripts)
    @javascripts = javascripts
  end

  def exec
    @javascripts.each do |javascript|
      `document.write('<script type="text/javascript" src="' + javascript + '"><\/script>');`
    end
  end
end
