define(['scripts/client/bootstrap.js'], function(){
  
  window.BoardView = Backbone.View.extend({
    template: T['board'],
    className: 'board',
    id: this._id,
    events: {
      "click a": "goToLobby"
    },
    initialize: function(model){
      this.model = model;
      this.render();
    },
    render: function(){
      //console.log('rendering board...');
      //console.log(this.model.get('players').toData())
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
      new OrderSubmit(this.model, current_player);

      $(this.el).show()

      return this;
    },
    goToLobby: function(e){
      e.preventDefault();
      $(this.el).remove();
      $(".lobby").show();
    }
  });

  MapView = Backbone.View.extend({
    className: "units",
    initialize: function(target, units){
      this.units = units;
      this.target = target;

      this.units.bind("reset", this.addAllUnits, this);

      $("#map").append(this.el); //TODO: should attach to target, not #map

      this.addAllUnits();
    },
    addUnit: function(unit){
      new MapUnit($(this.el), unit);
    },
    addAllUnits: function(){
      $(this.el).html("");
      _.each(this.units.toData(), function(unit){this.addUnit(unit)}, this);
    }
  });


  MapUnit = Backbone.View.extend({
    template: T['map_unit'],
    events: {
      "click":"clicked"
    },
    initialize: function(target, unit){//unit: {owner: "Ger",province:"Ber",utype:"a"}
      this.unit = unit;
      var loc = window.MAP_COORDS[unit.province]
      var top, left, color, sprite;
      if(loc!=undefined){
        top = loc[1] + "px";
        left = loc[0] + "px";
        if(unit.utype == 'f')
          sprite = window.FLEET_SPRITE[unit.owner];
        else
          sprite = window.ARMY_SPRITE[unit.owner];
      }

      $(this.el).html(this.template.r({top:top,left:left,sprite:sprite,utype:unit.utype}));

      $(target).append(this.el);
    },
    clicked: function(){
      alert(this.unit.province +' wuz clicked');
    }
  });


  UnitList = Backbone.View.extend({
    template: T['map'],
    initialize: function(units){
      this.units = units;
      
      this.units.bind("reset", function(){this.render()}, this);

      $('#map').append(this.el);

      this.render();
    },
    render: function(){
      $(this.el).html(this.template.r({units:this.units.toData()}));
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
    initialize: function(game, player){
      this.game = game;
      this.player = player;
      var s = this.game.get('state');
      var turn = this.game.get('turn');
      var u={};
      if(s=='secondary')//secondary state and fall turn
      {
        //get all units
        //get all units order.move==r and owner==myPower
        //get all units owner==power
        //count all supply centers
        //calculate retreat, and spawn or disband
        var units = this.game.get('units').toData();
        //find my current country
        var power = window.current_player.attributes.power;
        //find how many supply centers I should have
        var MAP=this.game.get('map');
        var mySupply=0;
        for(var x in MAP)
        {
          if(MAP[x].supply==1 && MAP[x].belongsto==power)
            mySupply++;
        }
        //find how many units I have
        var unitList=[];
        //do I have any retreats
        var retreatList=[];
        for(var x in units)
        {
          if(units[x].owner==power)
          {
            if(units[x].order.move=='r')
              retreatList.push(units[x]);
            unitList.push(units[x]);
          }
        }
        //console.log("unit list, my supply")
        //console.log(unitList)
        //console.log(mySupply)
        var numUnits=unitList.length;

        if(retreatList.length > 0)
        {
          u.msg1="You must retreat";
          u.retreat=retreatList;
        }
        if(turn%2==0)//if fall turn
          u.fall=true;
        if(u.fall && numUnits < mySupply)
        {
          var x = mySupply-numUnits;

          u.msg2="You can add " + x + " new unit(s)";
          var spawnPoints=[];
          u.spawnum=x;
          for(var y in window.MAP)
          {
            var coast=false;
            if(MAP[y].fleet_moves.length!=0)
              coast=true;
            if(MAP[y].spawn==power)
              spawnPoints.push({owner:power,province:y,coast:coast});
          }
          u.spawn=spawnPoints;
        }

        if(u.fall && numUnits > mySupply)
        {
          var x = numUnits-mySupply;
          u.msg3="Select "+x+" unit(s) to disband";
          u.disband=unitList;
        }
      }
      this.render(u);
      $('#side').append(this.el);
    },
    render: function(u){
      this.units = new UnitCollection(this.game.get('units').ownedBy(this.player.get('power')));
      //get game state to see what to render
      var turn = this.game.get('turn');
      var s = this.game.get('state');
      var v=[];
      if(u==undefined) 
        u=v;
      u.turn = turn;
      var season;     
      if(turn%2==0)
        season="Fall";
      else
        season="Spring";
      if(s=="primary")
        $(this.el).html(T['order_submit'].r({units:this.units.toData(),turn:turn,season:season}));
      else if (s=="secondary")
      {
        if(Object.keys(u).length==1 )
          u.msg1="You have no secondary moves"
        $(this.el).html(T['secondary_order'].r({derp:u,season:season,turn:turn}));
      }
      else
      {
        $(this.el).html(this.template.r({units:this.units.toData()}));
        console.log("OrderSubmit.render() is confused")
      }
    },
    events: {
      "click .submit" : "submitClicked",
      "click .resolve" : "resolveMoves",
      "click .resolvetwo": "resolveMovesTwo",
      "click .submittwo" : "submitClickedTwo",
      "change select.move" : "clickedMove",
      "change select.from" : "clickedMove"
    },
    submitClicked: function(e){
      e.preventDefault();
      var data = $(this.el).find("form").serializeArray();
      var orders=[];
      for(var x=0,sum=0; sum!=data.length; x+=1,sum+=4)
      {
        orders[x]={ order: {} };
        orders[x].owner=data[sum].value;
        orders[x].utype=data[sum+1].value;
        orders[x].province=data[sum+2].value;
        orders[x].order.move=data[sum+3].value;
        if(orders[x].order.move=="s")
        {
          orders[x].order.from=data[sum+4].value;
          orders[x].order.to=data[sum+5].value;
          sum+=2;
        }
        else if(orders[x].order.move=="m")
        {
          orders[x].order.from=orders[x].province;
          orders[x].order.to=data[sum+4].value;
          sum+=1;
        }
        else if(orders[x].order.move=="h")
        {
          orders[x].order.from=orders[x].province;
          orders[x].order.to=orders[x].province;
        }
      }
      //this.player.get('orders').add(orders);
      this.player.set({orders:orders});
      this.player.save();
/*
      socket.emit('game:submit',this.game.id,this.player.id,orders, _.bind(function(err,data){ 
        $(e.target).parent().replaceWith(T['order_submit_unit'].r({units:data}));
      },this));*/
    },
    submitClickedTwo: function(e){
      e.preventDefault();
      var data = $(this.el).find("form").serializeArray();

      var retreatOrders=[];
      var spawnOrders=[];
      var disbandOrders=[];
      var allowedSpawn=0;
      for(var x=0; x<data.length; )
      {
        if(data[x].name=="spawnum")
        {
          allowedSpawn=data[x].value;
          x++;
        }
        if(data[x].name=="name" && data[x].value=="retreat")
        {
          var move = data[x+4].value;
          if(move=="disband")
          {
            disbandOrders.push({
            "owner":data[x+1].value,
            "utype":data[x+2].value,
            "province":data[x+3].value,
            "move":"disband"
            });
            x+=5;
          }
          else
          {
            retreatOrders.push({
            "owner":data[x+1].value,
            "utype":data[x+2].value,
            "province":data[x+3].value,
            "move":data[x+5].value
            });
            x+=6;
          }
          //this take up 5 spaces
        }
        else if(data[x].name=="name" && data[x].value=="spawn")
        {
          if(data[x+3].value!="no new unit" && allowedSpawn>0)
          {
            spawnOrders.push({
              "owner":data[x+1].value,
              "province":data[x+2].value,
              "move":data[x+3].value
              });
            allowedSpawn--;
          }
          x+=4;
        } 
        else if(data[x].name=="name" && data[x].value=="disband")
        {
          var move = data[x+4].value;
          if(move!='hold')
          {
            disbandOrders.push({
              "owner":data[x+1].value,
              "utype":data[x+2].value,
              "province":data[x+3].value,
              "move":"disband"
              });
            }
            x+=5;   
        }
      }


      this.player.set({retreatorders:retreatOrders});
      this.player.set({spawnorders:spawnOrders});
      this.player.set({disbandorders:disbandOrders});
      this.player.save();
/*      console.log(this.player.get('retreatorders'));
      console.log(this.player.get('spawnorders'));
      console.log(this.player.get('disbandorders'));*/
      
    },
    resolveMoves: function(e)
    {
      e.preventDefault();
      socket.emit(
        'game:resolve',
        this.game.id,
        _.bind(
        function(err,units,supply,map){
          var u={};
          //find my current country
          var power = window.current_player.attributes.power;
          //find how many supply centers I should have
          var mySupply=supply[power];
          //find how many units I have
          var unitList=[];
          //do I have any retreats
          var retreatList=[];
          for(var x in units)
          {
            if(units[x].owner==power)
            {
              if(units[x].order.move=='r')
                retreatList.push(units[x]);
              unitList.push(units[x]);
            }
          }
          //console.log("unit list, my supply")
          //console.log(unitList)
          //console.log(mySupply)
          var numUnits=unitList.length;

          if(retreatList.length > 0)
          {
            u.msg1="You must retreat";
            u.retreat=retreatList;
          }
          var turn = this.game.get('turn');
          if(turn%2==0)//if fall turn
            u.fall=true;
          if(u.fall && numUnits < mySupply)
          {
            var x = mySupply-numUnits;

            u.msg2="You can add " + x + " new unit(s)";
            var spawnPoints=[];
            u.spawnum=x;
            for(var y in window.MAP)
            {
              var coast=false;
              if(MAP[y].fleet_moves.length!=0)
                coast=true;
              if(MAP[y].spawn==power)
                spawnPoints.push({owner:power,province:y,coast:coast});
            }
            u.spawn=spawnPoints;
          }

          if(u.fall && numUnits > mySupply)
          {
            var x = numUnits-mySupply;
            u.msg3="Select "+x+" unit(s) to disband";
            u.disband=unitList;
          }
          this.game.set({map:map});
          //update board with returned state
          this.game.set({units:units});//owner, utype, prov, move
          var turn = this.game.get('turn');
          //if(turn%2==0)//we are in a fall turn: set secondary state
            this.game.set({state:"secondary"});
          //else//only increment turn when we are in a non-fall turn
          //also delete orders if we are not going to secondary
          /*{
            //state is primary, stays primary
            this.game.set({turn:this.game.get('turn')+1});
            socket.emit('game:removeorders',this.game.id,_.bind(function(err){},this));
          }*/
          this.game.save();
          //this.render();
          /*$(e.target).parent().replaceWith(T['order_submit_unit'].r({units:units}));*/

          //ALWAYS GO TO SECONDARY MOVE PANE
          //EVEN IF YOU HAVE NO SECONDARY MOVES TO SUBMIT
          /*if(Object.keys(u).length!=0)
          {
            $(e.target).parent().replaceWith(T['secondary_order'].r({derp:u}));
          }
          else
          {
            this.render();
            socket.emit('game:removeorders',this.game.id,_.bind(function(err){},this));
          }*/
          this.render(u);
        },
        this));
    },
    resolveMovesTwo: function(e)
    {
      e.preventDefault();
      socket.emit(
        'game:resolvetwo',
        this.game.id,
        this.player.id,
        _.bind(
        function(err,data,map)
        {
          var d=[]
          for(var x in data)
          {
            if(data[x].owner==window.current_player.attributes.power)
              d.push(data[x]);
          }
          _.flatten(d,true);

          //update UI
          this.game.set({map:map});
          this.game.set({state:"primary"});
          this.game.set({turn:this.game.get('turn')+1});
          this.game.set({units:data});//owner, utype, prov, move
          this.game.save();
          this.player.set({retreatorders:[]});
          this.player.set({spawnorders:[]});
          this.player.set({disbandorders:[]});
          this.player.save();
          this.render();
        },
        this));
        socket.emit('game:removeorders',this.game.id,_.bind(function(err){},this));
    },
    clickedMove: function(e){
      var prov = $(e.target).parent().find("[name='prov']").val();
      var u= _.select(this.units.toData(), function(unit) { return unit.province == prov});
      //if province is coastal, set u.coast = true
      /*console.log(prov);
      console.log(this.game.get('map')[prov].fleet_moves)
      if(this.game.get('map')[prov].fleet_moves.length!=0)
        u.coast=true;
      console.log(u.coast)*/
      //var m=_.clone(window.MAP[prov]);
      var s=0;
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
          u.from=twoaway; //u.from = twoaway intersect unitlist
          u.to=m; //u.to = m intersect possible_moves(twoaway.selectedvalue)
          break;
        
        case "retreat":
          s=1;
          u.r=true;
          u.to=possible_moves(u[0]);
          var allunits=this.game.get('units').toData();
          var from;

          for(var x in allunits)
          {
            //Find other unit in this space
            if((allunits[x].province==u[0].province)
              && (u[0].owner!=allunits[x].owner))
            {
              from = allunits[x].order.from
            }
          }
          //take out where they came from from u.to
          u.to = _.reject(u.to,function(v){
            return v==from;
          })

        $(e.target).parent().replaceWith(T['retreat'].r({retreat:u}));
          break;

        case "disband":
          s=1;
          u.d=true;
        $(e.target).parent().replaceWith(T['retreat'].r({retreat:u}));
          break;

        case "no new unit":
        case "new army":
        case "new fleet":
        case "hold":
          s=1;
          break;
        
        default:
          console.log("move is not understood in clickedMove");
          
      }
      if(!s)
        $(e.target).parent().replaceWith(T['order_submit_unit'].r({units:u}));        
      //$(e.target).parent().replaceWith(T['secondary_order'].r({derp:u}));
    }
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