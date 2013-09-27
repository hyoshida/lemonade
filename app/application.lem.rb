novel 'Lemonade' do
  # TODO: change to this
  # entity (:lemon) { Lemon.new(name: 'レモン') }
  entity :Lemon do
    { name: 'レモン' }
  end

  entity :Ade do
    { name: 'エード' }
  end

  scene :one do
    Lemon.talk('Hello world!')
  end

  scene :two do
    Lemon.talk('はじめまして！')
    Lemon.talk('私はレモンです')
    Ade.talk('僕はエード')
    Ade.talk('よろしくお願いします')
  end

  scene :three do
    # TODO: change to this
    # lemon.talk('ひとりひとりが')
    # age.talk('順番に喋ることもできます')
    Lemon.talk('ひとりひとりが')
    Ade.talk('順番に喋ることもできます')

    event do
      Lemon.name = '？？？'
      Lemon.add_talk('名前を変えるのだって簡単！')
    end
  end

  chapter :first do
    scene :one
    scene :two
    scene :three
  end
end
