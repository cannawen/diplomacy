define(['scripts/client/bootstrap.js'], function(){
  
  window.BoardView = Backbone.View.extend({
    template: T['board'],
    className: 'board',
    id: this._id,
    events: {
      "click a": "goToLobby"
    },
    initialize: function(){
      this.render();
    },
    render: function(){
      console.log('rendering board...');
      $(this.el).html(this.template.r(this.model.toJSON()));

      if($("#diplomacy .board").length == 0){
        $('#diplomacy').append(this.el);
      } else {
        $('#diplomacy .board').replaceWith(this.el);
      }

      current_player = this.model.get('players').ownedBy(window.user);
      
      new ChatRoomList(this.model.get('chatrooms').ownedBy(current_player));

      new ChatRoomsView(this.model.get('chatrooms').ownedBy(current_player));
      new UnitList(this.model.get('units'));

      new MapView($(this.el), this.model.get('units')); //passed board(html) and units(bb model reference)

      // TODO: units.ownedBy should take (player) not ("power")
      new OrderSubmit(this.model.get('units').ownedBy(current_player.get('power')));

      return this;
    },
    goToLobby: function(e){
      e.preventDefault();
      $(this.el).hide();
      $(".lobby").show();
    }
  });

  MapView = Backbone.View.extend({
    className: "units",
    initialize: function(target, units){
      this.units = units.toData();
      this.target = target;

      $("#map").append(this.el); //TODO: should attach to target, not #map

      this.addAllUnits();
    },
    addUnit: function(unit){
      new MapUnit($(this.el), unit);
    },
    addAllUnits: function(){
      $(this.el).html("");
      _.each(this.units, function(unit){this.addUnit(unit)}, this);
    }
  });


  MapUnit = Backbone.View.extend({
    template: T['map_unit'],
    events: {
      "click":"clicked"
    },
    initialize: function(target){
      $(this.el).html(this.template.r({
        top: Math.floor(Math.random()*600)+"px", 
        left: Math.floor(Math.random()*600)+"px",
        color: "blue"
        }
      ));
      $(target).append(this.el);
    },
    clicked: function(){
      alert('i wuz clicked');
    }
  });


  UnitList = Backbone.View.extend({
    template: T['map'],
    initialize: function(units){


      $(this.el).html(this.template.r({units:units.toJSON()}));

      $('#map').append(this.el);
    }
  });

  ChatRoomList = Backbone.View.extend({
    template: T['chatrooms'],
    events: {
      "click li": "selectChatRoom"
    },
    initialize: function(chatrooms){

      _chatrooms = _.map(chatrooms, function(cr){
        if(cr.get('players').length == 2){
          player = cr.get('players').reject(function(p){ p == current_player})[0]
        
          return {
            id: cr.id,
            power: player.get('power'),
            user: player.get('user').toData(),
            online: false
           }
        }
        else {
          return {
            id: cr.id,
            power: "Global",
            user: {name: "All"},
            online: true
          }
        }
      });

      $(this.el).html(this.template.r({chatrooms:_chatrooms}));

      $('#side').append(this.el);
    },
    selectChatRoom: function(e){
      // hide all chatrooms
      $("#side .chatrooms .chatroom").hide();

      // show the selected
      $("#side .chatrooms .chatroom#"+$(e.target).attr("data-id")).show();

    }
  });

  OrderSubmit = Backbone.View.extend({
    className: 'order_submit',
    template: T['order_submit'],
    initialize: function(units){
      //TODO: we should find a way to do this without creating a new unitcollection
      this.units = new UnitCollection(units);

      $(this.el).html(this.template.r({units:this.units.toData()}));
      
      $('#side').append(this.el);
    },
    events: {
      "click .submit" : "parseOrders",
      "change select.move" : "clickedMove",
      "change select.from" : "clickedMove"
    },
    parseOrders: function(e){
      e.preventDefault();
      var data = $(this.el).find("form").serializeArray();
      var orders=[];
      console.log(data.length)
      console.log(sum);
      for(var x=0,sum=0; sum!=data.length; x+=1,sum+=2)
      {
        orders[x]={ order: {} };
        orders[x].prov=data[sum].value;
        orders[x].order.move=data[sum+1].value;
        if(orders[x].order.move=="s")
        {
          orders[x].order.from=data[sum+2].value;
          orders[x].order.to=data[sum+3].value;
          sum+=2;
        }
        else if(orders[x].order.move=="m")
        {
          orders[x].order.from=orders[x].prov;
          orders[x].order.to=data[sum+2].value;
          sum+=1;
        }
        else if(orders[x].order.move=="h")
        {
          orders[x].order.from=orders[x].prov;
          orders[x].order.to=orders[x].prov;
        }
      }

      console.log("SENDING ORDERS TO RESOLVE:");
      console.log(orders);
      socket.emit('game:resolve',orders, function(err,data){ 
        console.log(data);
      });
    },
    clickedMove: function(e){
      prov = $(e.target).parent().find("[name='prov']").val();
      var u= _.select(this.units.toData(), function(unit) { return unit.province == prov});
      //var m=_.clone(window.MAP[prov]);

      switch($(e.currentTarget).val())
      {
        case "h":
          u.move_h = true;
          u.from = u.province;
          u.to = u.province;
          break;

        case "m":
          u.move_m = true;
          u["to?"] = true
          u.to = possible_moves(u[0]);
          break;

        case "s":
          u.move_s = true;
          u["from?"] = true;
          u["to?"] = true;

          var m=possible_moves(u[0]);
          var twoaway = _.without(possible_support(m),prov);

          //TODO for more filtering
          u.from=twoaway; //twoaway intersect unitlist
          u.to=m; //m intersect possible_moves(twoaway.selectedvalue)
          break;
        
        default:
          
      }
      $(e.target).parent().replaceWith(T['order_submit_unit'].r({units:u}));
      
    },
  });

  function possible_support(to)
  {
    var ret=[];
    for(var x in to)
      ret = _.union(ret,window.MAP[to[x]].army_moves,window.MAP[to[x]].fleet_moves);
    return ret;
  }


  function possible_moves(unit)
  {
    if (unit.utype=="a" || unit.utype=="A")
      return window.MAP[unit.province].army_moves;
    else if(unit.utype=="f" || unit.utype=="F")
      return window.MAP[unit.province].fleet_moves;
  }

});