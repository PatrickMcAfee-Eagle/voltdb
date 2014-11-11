﻿
function alertNodeClicked(obj) {

    var clickedServer = $(obj).html();

    if ($('#activeServerName').html() != clickedServer) {

        $('.activeServerName').html(clickedServer).attr('title', clickedServer);

        //Change the active server name in the node list
        $("#serversList>li").removeClass("monitoring");

        $("#serversList").find("li a:contains(" + clickedServer + ")").filter(function () {
            return $(this).html() == clickedServer;
        }).parent().addClass("monitoring");

        var serverIp = voltDbRenderer.getServerIP($(obj).attr('data-ip'));
        var currentUrl = window.location.href.split('?')[0];
        var urlArray = currentUrl.split('/');
        var newUrl = '';
        if (urlArray != null && urlArray.length > 0) {
            var urlArray2 = urlArray[2].split(':');
            urlArray2[0] = serverIp;
            urlArray[2] = urlArray2.join(':');
            newUrl = urlArray.join('/');
        }

        var data = {
            CurrentServer: clickedServer,
            GraphView: $.cookie("graph-view"),
            DisplayPreferences: $.cookie("user-preferences"),
            AlertThreshold: $.cookie("alert-threshold"),
            username: $.cookie("username"),
            password: $.cookie("password")
        };

        var win = window.open(newUrl + '?data=' + JSON.stringify(data), '_parent');
        win.focus();
    }

    $('.popup_close').trigger('click');
};

(function (window) {

    var iVoltDbRenderer = (function () {
        this.nodeStatus = new Array();
        this.isProcedureSearch = false;
        this.isTableSearch = false;
        this.isProcedureSortClicked = false;
        this.isTableSortClicked = false;
        this.isNextClicked = false;
        this.userPreferences = {};
        this.procedureTableIndex = 0;
        this.procedureDataSize = 0;
        this.procedureSearchDataSize = 0;
        this.tableIndex = 0;
        this.tableDataSize = 0;
        this.tableSearchDataSize = 0;
        this.tupleCount = {};
        this.searchData = {};
        this.searchText = "";
        this.serverIPs = {};
        this.tupleMaxCount = {};
        this.tupleMinCount = {};
        this.maxVisibleRows = 5;
        this.sortOrder = "";
        this.sortTableOrder = "";
        this.refreshTables = false;
        var kFactor = 0;
        var procedureData = {};
        var procedureJsonArray = [];
        var procedureSearchJsonArray = [];
        var tableData = {};
        var tableJsonArray = [];
        var tableSearchJsonArray = [];
        var schemaCatalogTableTypes = {};
        var schemaCatalogColumnTypes = {};
        var systemOverview = {};
        var systemMemory = {};
        var htmlMarkups = { "SystemInformation": [] };
        var htmlMarkup;
        var htmlTableMarkups = { "SystemInformation": [] };
        var htmlTableMarkup="";
        var minLatency = 0;
        var maxLatency = 0;
        var avgLatency = 0;
        var procedureNameIndex = 0;
        var invocationsIndex = 0;
        var minLatencyIndex = 0;
        var maxLatencyIndex = 0;
        var avgLatencyIndex = 0;
        var perExecutionIndex = 0;

        var tableNameIndex = 5;
        var partitionIndex = 4;
        var hostIndex = 1;
        var tupleCountIndex = 3;

        //sorting related variables
        this.isSortProcedures = false;
        this.isSortTables = false;
        this.sortColumn = "";
        this.tableSortColumn = "";
        this.isPageAction = false;

        this.hint = "";

        this.ChangeServerConfiguration = function (serverName, portId, userName, pw, isHashPw, isAdmin) {
            VoltDBService.ChangeServerConfiguration(serverName, portId, userName, pw, isHashPw, isAdmin);
        };

        var testConnection = function (serverName, portId, username, password, admin, onInformationLoaded) {
            VoltDBService.TestConnection(serverName, portId, username, password, admin, function (result) {

                onInformationLoaded(result);
            });
        };

        this.CheckServerConnection = function (checkConnection) {
            VoltDBService.CheckServerConnection(checkConnection);
        };

        this.GetLoginPopup = function () {
            var loginHtml =
                '<a href="#loginBoxDialogue" id="loginLink" style="display: none;">Login</a>' +
                '<!-- POPUP Login -->' +
                '<div id="loginBoxDialogue" style="overflow: hidden" >' +
                    '<div class="overlay-title">Login</div>' +
                        '<div id="UnableToLoginMsg" style="padding: 5px 0 0 20px; color: #ff0000; display: none;">Unable to connect. Please try to login using another username/password.</div>' +
                            '<div class="clear"></div>' +
                            '<div  class="overlay-content" style="height:215px; min-width: 441px; padding: 0" >' +
                            '<div id="loginBox">' +
                                '<label for="username">Username:</label>' +
                                '<input type="text" id="username" name="username"><br/>' +
                                '<label for="password">Password:</label>' +
                                '<input type="password" id="password" name="password">' +
                                '<div class="lower">' +
                                    '<input type="submit" id="LoginBtn" value="Login">' +
                                '</div>' +
                            '</div>' +
                    '</div>    ' +
                '</div>' +
                '<!-- POPUP Login -->';
            return loginHtml;
        };

        this.HandleLogin = function (serverName, portId, pageLoadCallback) {

            var popupDisplayed = false;
            $("#username").data("servername", serverName);
            $("#username").data("portid", portId);
            $("#loginBoxDialogue").hide();
            $("#loginLink").popup({
                open: function (event, ui, ele) {
                },
                login: function (popupCallback) {

                    $("#overlay").show();
                    $("#UnableToLoginMsg").hide();
                    var usernameVal = $("#username").val();
                    var passwordVal = $("#password").val() != '' ? $().crypt({ method: "sha1", source: $("#password").val() }) : $("#password").val();

                    testConnection($("#username").data("servername"), $("#username").data("portid"), usernameVal, passwordVal, true, function (result) {
                        $("#overlay").hide();
                        if (result) {

                            //Save user details to cookie.
                            saveSessionCookie("username", usernameVal);
                            saveSessionCookie("password", passwordVal);
                            voltDbRenderer.ShowUsername(usernameVal);
                            popupDisplayed = true;

                            pageLoadCallback();
                            popupCallback();
                            $("#loginBoxDialogue").hide();
                            $("#username").val("");
                            $("#password").val("");
                            $("#logOut").css('display', 'block');
                            $('#logOut').prop('title', $.cookie("username"));
                        } else {
                            $("#UnableToLoginMsg").show();
                            $("#logOut").css('display', 'none');
                            $('#logOut').prop('title', '');
                        }
                    });
                }
            });

            $('#username').keypress(function (e) {
                var key = e.which;
                if (key == 13)  // the enter key code
                {
                    $("#LoginBtn").trigger("click");
                    return false;
                }
                return true;
            });
            $('#password').keypress(function (e) {
                var key = e.which;
                if (key == 13)  // the enter key code
                {
                    $("#LoginBtn").trigger("click");
                    return false;
                }
                return true;
            });

            var username = ($.cookie("username") != undefined) ? $.cookie("username") : "";
            var password = (username != "" && $.cookie("password") != undefined) ? $.cookie("password") : "";

            $("#overlay").show();
            //Try to login with saved username/password or no username and password
            testConnection(serverName, portId, username, password, true, function (result) {

                $("#overlay").hide();
                if (!popupDisplayed) {
                    //If security is enabled, then display popup to get username and password.
                    if (!result) {
                        saveSessionCookie("username", null);
                        saveSessionCookie("password", null);

                        $("#loginLink").trigger("click");
                    } else {
                        popupDisplayed = true;
                        pageLoadCallback();
                    }
                }
                popupDisplayed = true;
            });
        };

        this.ShowUsername = function (userName) {
            if (userName != undefined && userName != 'null' && userName != '') {
                $(".userN").html(userName);
                $("#userLine").show();
            } else {
                $(".userN").html("");
                $("#userLine").hide();
            }
        };

        this.GetSystemInformation = function (onInformationLoaded) {
            VoltDBService.GetSystemInformation(function (connection) {
                populateSystemInformation(connection);
                getMemoryDetails(connection, systemMemory);
                onInformationLoaded();
            });
        };

        this.getDatabaseInformation = function (onInformationLoaded) {
            var procedureMetadata = "";

            VoltDBService.GetSystemInformationDeployment(function (connection) {
                setKFactor(connection);
                VoltDBService.GetProceduresInformation(function (nestConnection) {
                    populateProceduresInformation(nestConnection);
                    procedureMetadata = procedureData;

                    VoltDBService.GetDataTablesInformation(function (inestConnection) {
                        populateTableTypes(inestConnection);
                        populateTablesInformation(inestConnection);

                        populatePartitionColumnTypes(inestConnection);
                        onInformationLoaded(procedureMetadata, inestConnection.Metadata['@Statistics_TABLE'].data);
                    });
                });
            });

            var setKFactor = function (connection) {
                connection.Metadata['@SystemInformation_DEPLOYMENT'].data.forEach(function (entry) {
                    if (entry[0] == 'kfactor')
                        kFactor = entry[1];
                });

            };


        };

        this.GetDataTablesInformation = function (contextConnectionReturned) {
            VoltDBService.GetDataTablesInformation(function (inestConnection) {
                contextConnectionReturned(inestConnection);
            });
        };

        this.getMemoryGraphInformation = function (onInformationLoaded) {
            var memoryDetails = {};

            VoltDBService.GetMemoryInformation(function (connection) {
                getMemoryDetails(connection, memoryDetails, "GRAPH_MEMORY");
                onInformationLoaded(memoryDetails);
            });
        };

        this.getLatencyGraphInformation = function (onInformationLoaded) {
            var latencyDetails = {};

            VoltDBService.GetGraphLatencyInformation(function (connection) {
                getLatencyDetails(connection, latencyDetails);
                onInformationLoaded(latencyDetails);
            });
        };

        this.getCpuGraphInformation = function (onInformationLoaded) {
            var cpuDetails = {};

            VoltDBService.GetCPUInformation(function (connection) {
                getCpuDetails(connection, cpuDetails);
                onInformationLoaded(cpuDetails);
            });

        };

        //Render Cluster Transaction Graph
        this.GetTransactionInformation = function (onInformationLoaded) {
            var transactionDetails = {};

            VoltDBService.GetTransactionInformation(function (connection) {
                getTransactionDetails(connection, transactionDetails);
                onInformationLoaded(transactionDetails);
            });
        };

        this.GetTableInformation = function (onInformationLoaded) {
            VoltDBService.GetTableInformation(function (connection) {
                var tablesData = {};
                var viewsData = {};
                var proceduresData = {};
                var procedureColumnsData = {};
                var sysProceduresData = {};
                getTableData(connection, tablesData, viewsData, proceduresData, procedureColumnsData, sysProceduresData, 'TABLE_INFORMATION');
                onInformationLoaded(tablesData, viewsData, proceduresData, procedureColumnsData, sysProceduresData);
            });
        };

        //this.getStoredProceduresAndTableInformation = function (onProcedureAndDataTablesInformationLoaded) {
        //    if (this.userPreferences) {
        //        if (this.userPreferences['DatabaseTables'] == true) {
        //            VoltDBService.GetDataTablesInformation(function (connection) {
        //                populateTablesInformation(connection);

        //            });
        //        }

        //        if (this.userPreferences['StoredProcedures'] == true) {
        //            VoltDBService.GetProceduresInformation(function (connection) {
        //                populateProceduresInformation(connection);
        //            });
        //        }
        //        onProcedureAndDataTablesInformationLoaded();
        //    }
        //};

        this.getTablesInformationByIndex = function (onDataTablesInformationLoaded) {
            VoltDBService.GetDataTablesInformation(function (connection) {
                populateTablesInformation(connection);
            });
            onDataTablesInformationLoaded();
        };

        this.getProceduresInformationByIndex = function (onProcedureInformationLoaded) {
            VoltDBService.GetDataTablesInformation(function (connection) {
                populateTablesInformation(connection);
            });
            onProcedureInformationLoaded();

        };

        //this.getProcedureData = function (onProcedureDataTraversed) {
        //    VoltDBService.GetProceduresInformation(function (nestConnection) {
        //        populateProceduresInformation(nestConnection);

        //    });

        //    VoltDBService.GetDataTablesInformation(function (nestConnection) {
        //        populateTablesInformation(nestConnection);
        //        populateTableTypes(nestConnection);
        //        onProcedureDataTraversed();
        //    });
        //};

        this.GetHostNodesHtml = function (callback) {
            try {
                VoltDBService.GetHostNodes(function (connection, state) {
                    populateSystemInformation(connection);
                    callback();
                });
            } catch (e) {

            }
        };

        this.GetClusterHealth = function (callback) {
            if (systemOverview == null || systemOverview == undefined) {
                alert("Error: Unable to extract cluster health information.");
                return;
            }

            var activeCount = 0;
            var joiningCount = 0;
            var missingCount = 0;
            var alertCount = 0;

            jQuery.each(systemOverview, function (id, val) {
                if (val["CLUSTERSTATE"] == "RUNNING")
                    activeCount++;
                else if (val["CLUSTERSTATE"] == "JOINING")
                    joiningCount++;
                else if (val["CLUSTERSTATE"] == "MISSING")
                    missingCount++;
            });


            var html =
                '<li class="activeIcon">Active <span id="activeCount">(' + activeCount + ')</span></li>' +
                    '<li class="joiningIcon">Joining <span id="joiningCount">(' + joiningCount + ')</span></li>' +
                    '<li class="missingIcon">Missing <span id="missingCount">(' + missingCount + ')</span></li>';

            var alertHtml = "";

            jQuery.each(systemMemory, function (id, val) {

                var threshold = $.cookie("alert-threshold") != undefined ? $.cookie("alert-threshold") : 90;
                if (val["MEMORYUSAGE"] * 1 >= threshold) {
                    alertHtml += '<li class="active"><a data-ip="' + systemMemory[val['HOSTNAME']]['HOST_ID'] + '" onclick=\"alertNodeClicked(this);\" href=\"#\">' + val['HOSTNAME'] + '</a> <span class=\"memory-status alert\">' + val['MEMORYUSAGE'] + '%</span></li>';
                    alertCount++;
                }
            });

            if (alertCount > 0) {
                html += '<li class="alertIcon"><a href="#memoryAlerts" id="showMemoryAlerts">Alert <span>(' + alertCount + ')</span></a></li>';
            }

            callback(html, alertHtml);
        };

        var populateSystemInformation = function (connection) {
            connection.Metadata['@SystemInformation_OVERVIEW'].data.forEach(function (entry) {
                var singleData = entry;
                var id = singleData[0];

                if (!systemOverview.hasOwnProperty(id)) {
                    systemOverview[id] = {};
                }
                systemOverview[id][singleData[1]] = singleData[2];
            });
        };

        var populateTablesInformation = function (connection) {
            var counter = 0;
            voltDbRenderer.refreshTables = true;
            connection.Metadata['@Statistics_TABLE'].schema.forEach(function (columnInfo) {

                if (columnInfo["name"] == "HOST_ID")
                    hostIndex = counter;

                if (columnInfo["name"] == "TABLE_NAME")
                    tableNameIndex = counter;

                else if (columnInfo["name"] == "PARTITION_ID")
                    partitionIndex = counter;

                else if (columnInfo["name"] == "TUPLE_COUNT")
                    tupleCountIndex = counter;


                counter++;
            });

            counter = 0;

            if (voltDbRenderer.isSortTables && !voltDbRenderer.isTableSearch) { //is sorting is enabled create json array first to contain sort data on it,
                //then after sorting add it to a parent json object procedureData
                populateTableJsonArray(connection);
                if (voltDbRenderer.sortTableOrder == "ascending") {
                    tableJsonArray = ascendingSortJSON(tableJsonArray, voltDbRenderer.tableSortColumn);

                } else if (voltDbRenderer.sortTableOrder == "descending") {
                    tableJsonArray = descendingSortJSON(tableJsonArray, voltDbRenderer.tableSortColumn);

                }
                mapJsonArrayToTables();

            } else if (voltDbRenderer.isSortTables && voltDbRenderer.isTableSearch) {
                voltDbRenderer.formatSearchTablesDataToJsonArray(connection, voltDbRenderer.searchText);
                if (voltDbRenderer.sortTableOrder == "ascending") {
                    tableSearchJsonArray = ascendingSortJSON(tableSearchJsonArray, voltDbRenderer.tableSortColumn);

                } else if (voltDbRenderer.sortTableOrder == "descending") {
                    tableSearchJsonArray = descendingSortJSON(tableSearchJsonArray, voltDbRenderer.tableSortColumn);

                }
                mapJsonArrayToSearchedTables();

            } else {
                formatTableData(connection);

            }
            voltDbRenderer.refreshTables = false;
        };

        var populateProceduresInformation = function (connection) {
            var counter = 0;

            if (connection != null) {
                connection.Metadata['@Statistics_PROCEDUREPROFILE'].schema.forEach(function (columnInfo) {
                    if (columnInfo["name"] == "PROCEDURE")
                        procedureNameIndex = counter;
                    else if (columnInfo["name"] == "INVOCATIONS")
                        invocationsIndex = counter;
                    else if (columnInfo["name"] == "MIN")
                        minLatencyIndex = counter;
                    else if (columnInfo["name"] == "MAX")
                        maxLatencyIndex = counter;
                    else if (columnInfo["name"] == "AVG")
                        avgLatencyIndex = counter;
                    else if (columnInfo["name"] == "WEIGHTED_PERC")
                        perExecutionIndex = counter;

                    counter++;

                });

                if (voltDbRenderer.isSortProcedures && !voltDbRenderer.isProcedureSearch) { //is sorting is enabled create json array first to contain sort data on it,
                    //then after sorting add it to a parent json object procedureData
                    populateProcedureJsonArray(connection);
                    if (voltDbRenderer.sortOrder == "ascending") {
                        procedureJsonArray = ascendingSortJSON(procedureJsonArray, voltDbRenderer.sortColumn);

                    } else if (voltDbRenderer.sortOrder == "descending") {
                        procedureJsonArray = descendingSortJSON(procedureJsonArray, voltDbRenderer.sortColumn);

                    }
                    mapJsonArrayToProcedures();

                } else if (voltDbRenderer.isSortProcedures && voltDbRenderer.isProcedureSearch) {
                    voltDbRenderer.formatSearchDataToJsonArray(false);
                    if (voltDbRenderer.sortOrder == "ascending") {
                        procedureSearchJsonArray = ascendingSortJSON(procedureSearchJsonArray, voltDbRenderer.sortColumn);

                    } else if (voltDbRenderer.sortOrder == "descending") {
                        procedureSearchJsonArray = descendingSortJSON(procedureSearchJsonArray, voltDbRenderer.sortColumn);

                    }
                    mapJsonArrayToSearchedProcedures();

                } else {
                    populateProcedureData(connection);

                }

                voltDbRenderer.procedureDataSize = connection.Metadata['@Statistics_PROCEDUREPROFILE'].data.length;

            }
        };

        var populateProcedureData = function (connection) {
            var procedureCount = 0;
            var procedure = {};
            procedureData = [];

            if (connection.Metadata['@Statistics_PROCEDUREPROFILE'].data != "" &&
                connection.Metadata['@Statistics_PROCEDUREPROFILE'].data != [] &&
                connection.Metadata['@Statistics_PROCEDUREPROFILE'].data != undefined) {
                connection.Metadata['@Statistics_PROCEDUREPROFILE'].data.forEach(function (entry) {
                    var name = entry[procedureNameIndex];
                    minLatency = entry[minLatencyIndex] * Math.pow(10, -6);
                    maxLatency = entry[maxLatencyIndex] * Math.pow(10, -6);
                    avgLatency = entry[avgLatencyIndex] * Math.pow(10, -6);

                    minLatency = parseFloat(minLatency.toFixed(2));
                    maxLatency = parseFloat(maxLatency.toFixed(2));
                    avgLatency = parseFloat(avgLatency.toFixed(2));

                    if (!procedureData.hasOwnProperty(name)) {
                        procedure = {
                            'PROCEDURE': entry[procedureNameIndex],
                            'INVOCATIONS': entry[invocationsIndex],
                            'MIN_LATENCY': minLatency,
                            'MAX_LATENCY': maxLatency,
                            'AVG_LATENCY': avgLatency,
                            'PERC_EXECUTION': entry[perExecutionIndex]
                        };
                        procedureData.push(procedure);

                        procedureCount++;
                    }

                });
            } else {
                formatTableNoData("PROCEDURE");

            }
        };

        var populateProcedureJsonArrayForSorting = function (connection) {
            var procedureCount = 0;
            if (connection != null) {

                var isPopulateSortData = checkSortColumnSortable();
                if (connection.Metadata['@Statistics_PROCEDUREPROFILE'] != undefined) {
                    connection.Metadata['@Statistics_PROCEDUREPROFILE'].data.forEach(function (entry) {
                        var name = entry[procedureNameIndex];
                        minLatency = entry[minLatencyIndex] * Math.pow(10, -6);
                        maxLatency = entry[maxLatencyIndex] * Math.pow(10, -6);
                        avgLatency = entry[avgLatencyIndex] * Math.pow(10, -6);

                        minLatency = parseFloat(minLatency.toFixed(2));
                        maxLatency = parseFloat(maxLatency.toFixed(2));
                        avgLatency = parseFloat(avgLatency.toFixed(2));

                        if (!procedureData.hasOwnProperty(name)) {
                            procedureData[name] = {};
                        } else {
                            procedureData[name]['PROCEDURE'] = entry[procedureNameIndex];
                            procedureData[name]['INVOCATIONS'] = entry[invocationsIndex];
                            procedureData[name]['MIN_LATENCY'] = minLatency;
                            procedureData[name]['MAX_LATENCY'] = maxLatency;
                            procedureData[name]['AVG_LATENCY'] = avgLatency;
                            procedureData[name]['PERC_EXECUTION'] = entry[perExecutionIndex];
                            procedureCount++;

                        }

                    });
                }

                procedureJsonArray = [];
                procedureCount = 0;
                if (voltDbRenderer.searchText == "" || voltDbRenderer.searchText == undefined || isPopulateSortData) {
                    jQuery.each(procedureData, function (key, data) {
                        if (!checkIfDuplicateJson(procedureJsonArray, key)) {
                            procedureJsonArray[procedureCount] = {
                                "PROCEDURE": data.PROCEDURE,
                                "INVOCATIONS": data.INVOCATIONS,
                                "MIN_LATENCY": data.MIN_LATENCY,
                                "MAX_LATENCY": data.MAX_LATENCY,
                                "AVG_LATENCY": data.AVG_LATENCY,
                                "PERC_EXECUTION": data.PERC_EXECUTION
                            };
                            procedureCount++;
                        }
                    });

                }

            }

        };

        var populateProcedureJsonArray = function (connection) {
            var procedureCount = 0;
            if (connection != undefined) {
                if (connection.Metadata['@Statistics_PROCEDUREPROFILE'].data != undefined) {
                    //apply search only if column is "PROCEDURE"
                    var isPopulateSortData = checkSortColumnSortable();
                    procedureJsonArray = [];

                    connection.Metadata['@Statistics_PROCEDUREPROFILE'].data.forEach(function (entry) {
                        if (voltDbRenderer.searchText == "" || voltDbRenderer.searchText == undefined) {
                            var name = entry[procedureNameIndex];
                            minLatency = entry[minLatencyIndex] * Math.pow(10, -6);
                            maxLatency = entry[maxLatencyIndex] * Math.pow(10, -6);
                            avgLatency = entry[avgLatencyIndex] * Math.pow(10, -6);

                            minLatency = parseFloat(minLatency.toFixed(2));
                            maxLatency = parseFloat(maxLatency.toFixed(2));
                            avgLatency = parseFloat(avgLatency.toFixed(2));

                            if (!checkIfDuplicateJson(procedureJsonArray, entry[procedureNameIndex])) {
                                procedureJsonArray[procedureCount] = {
                                    "PROCEDURE": entry[procedureNameIndex],
                                    "INVOCATIONS": entry[invocationsIndex],
                                    "MIN_LATENCY": minLatency,
                                    "MAX_LATENCY": maxLatency,
                                    "AVG_LATENCY": avgLatency,
                                    "PERC_EXECUTION": entry[perExecutionIndex]
                                };
                                procedureCount++;
                            }
                        } else {
                            if (isPopulateSortData) {
                                var name = entry[procedureNameIndex];
                                minLatency = entry[minLatencyIndex] * Math.pow(10, -6);
                                maxLatency = entry[maxLatencyIndex] * Math.pow(10, -6);
                                avgLatency = entry[avgLatencyIndex] * Math.pow(10, -6);

                                minLatency = parseFloat(minLatency.toFixed(2));
                                maxLatency = parseFloat(maxLatency.toFixed(2));
                                avgLatency = parseFloat(avgLatency.toFixed(2));

                                if (!checkIfDuplicateJson(procedureJsonArray, entry[procedureNameIndex])) {
                                    procedureJsonArray[procedureCount] = {
                                        "PROCEDURE": entry[procedureNameIndex],
                                        "INVOCATIONS": entry[invocationsIndex],
                                        "MIN_LATENCY": minLatency,
                                        "MAX_LATENCY": maxLatency,
                                        "AVG_LATENCY": avgLatency,
                                        "PERC_EXECUTION": entry[perExecutionIndex]
                                    };
                                    procedureCount++;
                                }
                            }
                        }

                    });

                }
            }
        };

        var populateTableJsonArray = function (connection) {
            var tableCount = 0;
            formatTableData(connection);
            if (tableData != undefined || tableData != "") {

                //apply search only if column is "TABLENAME"                
                if (!voltDbRenderer.isTableSearch) {

                    tableJsonArray = [];

                    $.each(tableData, function (key, data) {
                        tableJsonArray[tableCount] = {
                            "TABLE_NAME": key,
                            "MAX_ROWS": data["MAX_ROWS"],
                            "MIN_ROWS": data["MIN_ROWS"],
                            "AVG_ROWS": data["AVG_ROWS"],
                            "TUPLE_COUNT": data["TUPLE_COUNT"],
                            "TABLE_TYPE": getColumnTypes(key) == "PARTITION_COLUMN" ? "PARTITIONED" : schemaCatalogTableTypes[key].TABLE_TYPE
                        };
                        tableCount++;
                    });
                }
                else {

                    tableSearchJsonArray = [];

                    $.each(lSearchData.tables, function (key, data) {
                        tableSearchJsonArray[tableCount] = {
                            "TABLE_NAME": key,
                            "MAX_ROWS": data["MAX_ROWS"],
                            "MIN_ROWS": data["MIN_ROWS"],
                            "AVG_ROWS": data["AVG_ROWS"],
                            "TUPLE_COUNT": data["TUPLE_COUNT"],
                            "TABLE_TYPE": getColumnTypes(key) == "PARTITION_COLUMN" ? "PARTITIONED" : schemaCatalogTableTypes[key].TABLE_TYPE
                        };
                        tableCount++;
                    });
                }

            }
        };

        var populateTableTypes = function (connection) {
            var counter = 0;
            var tableName;
            var tableNameIndex = 0;
            var tableTypeIndex = 0;
            var remarksIndex = 0;

            connection.Metadata['@SystemCatalog_TABLES'].schema.forEach(function (columnInfo) {
                if (columnInfo["name"] == "TABLE_NAME")
                    tableNameIndex = counter;

                if (columnInfo["name"] == "TABLE_TYPE")
                    tableTypeIndex = counter;

                if (columnInfo["name"] == "REMARKS")
                    remarksIndex = counter;

                counter++;
            });

            connection.Metadata['@SystemCatalog_TABLES'].data.forEach(function (entry) {
                tableName = entry[tableNameIndex];
                if (!schemaCatalogTableTypes.hasOwnProperty(tableName)) {
                    schemaCatalogTableTypes[tableName] = {};
                    schemaCatalogTableTypes[tableName]['TABLE_NAME'] = entry[tableNameIndex];
                    schemaCatalogTableTypes[tableName]['TABLE_TYPE'] = entry[tableTypeIndex];
                    schemaCatalogTableTypes[tableName]['REMARKS'] = entry[remarksIndex];

                }
            });

        };

        var populatePartitionColumnTypes = function (connection) {
            var counterColumns = 0;
            var columnName;
            var columnNameIndex = 0;
            var tableNameColumnsIndex = 0;
            var remarksColumnsIndex = 0;

            connection.Metadata['@SystemCatalog_COLUMNS'].schema.forEach(function (columnInfo) {
                if (columnInfo["name"] == "COLUMN_NAME")
                    columnNameIndex = counterColumns;

                if (columnInfo["name"] == "TABLE_NAME")
                    tableNameColumnsIndex = counterColumns;

                if (columnInfo["name"] == "REMARKS")
                    remarksColumnsIndex = counterColumns;

                counterColumns++;
            });

            connection.Metadata['@SystemCatalog_COLUMNS'].data.forEach(function (entry) {
                columnName = entry[columnNameIndex];

                if (entry[remarksColumnsIndex] == "PARTITION_COLUMN") {
                    if (!schemaCatalogColumnTypes.hasOwnProperty(columnName)) {
                        schemaCatalogColumnTypes[columnName] = {};
                        schemaCatalogColumnTypes[columnName]['COLUMN_NAME'] = entry[columnNameIndex];
                        schemaCatalogColumnTypes[columnName]['TABLE_NAME'] = entry[tableNameColumnsIndex];
                        schemaCatalogColumnTypes[columnName]['REMARKS'] = entry[remarksColumnsIndex];

                    }
                }
            });

        };

        this.mapNodeInformationByStatus = function (callback) {
            var counter = 0;
            var memoryThreshold = $.cookie("alert-threshold") != '' ? $.cookie("alert-threshold") : -1;
            var htmlMarkups = { "ServerInformation": [] };
            var htmlMarkup;
            var currentServerHtml;

            if (systemOverview == null || systemOverview == undefined) {
                alert("Error: Unable to extract Node Status");
                return;
            }

            var currentServer = getCurrentServer();
            if (currentServer != null) {
                currentServerHtml = currentServer;
            } else {
                currentServerHtml = "";
            }

            jQuery.each(systemOverview, function (id, val) {
                var hostName;
                hostName = val["HOSTNAME"];

                if (counter == 0) {
                    /*************************************************************************
                    //CLUSTERSTATE implies if server is running or joining
                    **************************************************************************/
                    if (val["HOSTNAME"] != null && val["CLUSTERSTATE"] == "RUNNING" && (currentServerHtml == "" || currentServer == hostName)) {
                        if (systemMemory[hostName]["MEMORYUSAGE"] >= memoryThreshold) {
                            htmlMarkup = "<li class=\"active monitoring\"><a class=\"alertIcon\" data-ip=\"" + systemMemory[hostName]["HOST_ID"] + "\"  href=\"javascript:void(0);\">" + hostName + "</a> <span class=\"memory-status alert\">" + systemMemory[hostName]["MEMORYUSAGE"] + "%</span></li>";
                            currentServerHtml = hostName;

                        } else {
                            htmlMarkup = "<li class=\"active monitoring\"><a data-ip=\"" + systemMemory[hostName]["HOST_ID"] + "\" href=\"javascript:void(0);\">" + hostName + "</a> <span class=\"memory-status\">" + systemMemory[hostName]["MEMORYUSAGE"] + "%</span></li>";
                            currentServerHtml = hostName;
                        }

                    } else if (val["HOSTNAME"] != null && val["CLUSTERSTATE"] == "RUNNING" && currentServer != hostName) {
                        if (systemMemory[hostName]["MEMORYUSAGE"] >= memoryThreshold) {
                            htmlMarkup = "<li class=\"active\"><a class=\"alertIcon\" data-ip=\"" + systemMemory[hostName]["HOST_ID"] + "\" href=\"javascript:void(0);\">" + hostName + "</a> <span class=\"memory-status alert\">" + systemMemory[hostName]["MEMORYUSAGE"] + "%</span><span class=\"hostIdHidden\" style=\"display:none\">" + systemMemory[hostName]["HOST_ID"] + "</span></li>";
                        } else {
                            htmlMarkup = "<li class=\"active\"><a data-ip=\"" + systemMemory[hostName]["HOST_ID"] + "\" href=\"javascript:void(0);\">" + hostName + "</a> <span class=\"memory-status\">" + systemMemory[hostName]["MEMORYUSAGE"] + "%</span></li>";
                        }

                    } else if (val["HOSTNAME"] != null && val["CLUSTERSTATE"] == "JOINING") {
                        if (systemMemory[hostName]["MEMORYUSAGE"] >= memoryThreshold) {
                            htmlMarkup = htmlMarkup + "<li class=\"joining\"><a class=\"alertIcon\" data-ip=\"" + systemMemory[hostName]["HOST_ID"] + "\" href=\"javascript:void(0);\">" + hostName + "</a> <span class=\"memory-status alert\">" + systemMemory[hostName]["MEMORYUSAGE"] + "%</span><span class=\"hostIdHidden\" style=\"display:none\">" + systemMemory[hostName]["HOST_ID"] + "</span></li>";

                        } else {
                            htmlMarkup = htmlMarkup + "<li class=\"joining\"><a data-ip=\"" + systemMemory[hostName]["HOST_ID"] + "\" href=\"javascript:void(0);\">" + hostName + "</a> <span class=\"memory-status\">" + systemMemory[hostName]["MEMORYUSAGE"] + "%</span></li>";
                        }
                    }


                } else {
                    /********************************************************************************************
                    "currentServerHtml" is validated to verify if current server to be monitored is already set
                    *********************************************************************************************/
                    if (val["HOSTNAME"] != null && val["CLUSTERSTATE"] == "RUNNING" && currentServerHtml != "" && currentServerHtml == val["HOSTNAME"]) {
                        if (systemMemory[hostName]["MEMORYUSAGE"] >= memoryThreshold) {
                            htmlMarkup = htmlMarkup + "<li class=\"active monitoring\"><a class=\"alertIcon\" data-ip=\"" + systemMemory[hostName]["HOST_ID"] + "\" href=\"javascript:void(0);\">" + hostName + "</a> <span class=\"memory-status alert\">" + systemMemory[hostName]["MEMORYUSAGE"] + "%</span></li>";

                        } else {
                            htmlMarkup = htmlMarkup + "<li class=\"active monitoring\"><a data-ip=\"" + systemMemory[hostName]["HOST_ID"] + "\" href=\"javascript:void(0);\">" + hostName + "</a> <span data-ip=\"" + systemMemory[hostName]["HOST_ID"] + "\"class=\"memory-status\">" + systemMemory[hostName]["MEMORYUSAGE"] + "%</span></li>";
                        }
                    }

                    if (val["HOSTNAME"] != null && val["CLUSTERSTATE"] == "RUNNING" && currentServerHtml != val["HOSTNAME"]) {
                        if (systemMemory[hostName]["MEMORYUSAGE"] >= memoryThreshold) {
                            htmlMarkup = htmlMarkup + "<li class=\"active\"><a class=\"alertIcon\" data-ip=\"" + systemMemory[hostName]["HOST_ID"] + "\" href=\"javascript:void(0);\">" + hostName + "</a> <span class=\"memory-status alert\">" + systemMemory[hostName]["MEMORYUSAGE"] + "%</span></li>";

                        } else {
                            htmlMarkup = htmlMarkup + "<li class=\"active\"><a data-ip=\"" + systemMemory[hostName]["HOST_ID"] + "\" href=\"javascript:void(0);\">" + hostName + "</a> <span class=\"memory-status\">" + systemMemory[hostName]["MEMORYUSAGE"] + "%</span></li>";
                        }

                    }

                    if (val["HOSTNAME"] != null && val["CLUSTERSTATE"] == "JOINING") {
                        if (systemMemory[hostName]["MEMORYUSAGE"] >= memoryThreshold) {
                            htmlMarkup = htmlMarkup + "<li class=\"joining\"><a class=\"alertIcon\" data-ip=\"" + systemMemory[hostName]["HOST_ID"] + "\" href=\"javascript:void(0);\">" + hostName + "</a> <span class=\"memory-status alert\">" + systemMemory[hostName]["MEMORYUSAGE"] + "%</span></li>";

                        } else {
                            htmlMarkup = htmlMarkup + "<li class=\"joining\"><a data-ip=\"" + systemMemory[hostName]["HOST_ID"] + "\" href=\"javascript:void(0);\">" + hostName + "</a> <span class=\"memory-status\">" + systemMemory[hostName]["MEMORYUSAGE"] + "%</span></li>";
                        }

                    }
                }
                counter++;
            });
            htmlMarkups.ServerInformation.push({ "ServersList": htmlMarkup });
            htmlMarkups.ServerInformation.push({ "CurrentServer": currentServerHtml });
            callback(htmlMarkups);
        };

        this.mapProcedureInformation = function (currentAction, priorAction, callback) {
            var counter = 0;
            var pageStartIndex = 0;
            var isNextButtonClicked = false;
            htmlMarkup = "";
            htmlMarkups.SystemInformation = [];

            if (procedureData == null || procedureData == undefined) {
                alert("Error: Unable to extract Procedure Data");
                return;
            }

            //if checks if tuple count is greater than 5
            //other no needs for pagination action validation
            if ((((voltDbRenderer.procedureTableIndex + 1) * this.maxVisibleRows < voltDbRenderer.procedureDataSize) && currentAction == VoltDbUI.ACTION_STATES.NEXT) ||
                (currentAction == VoltDbUI.ACTION_STATES.PREVIOUS && voltDbRenderer.procedureTableIndex > 0) ||
                currentAction == VoltDbUI.ACTION_STATES.REFRESH ||
                currentAction == VoltDbUI.ACTION_STATES.SEARCH ||
                currentAction == VoltDbUI.ACTION_STATES.NONE) {

                if (currentAction == VoltDbUI.ACTION_STATES.NEXT) {
                    pageStartIndex = (voltDbRenderer.procedureTableIndex + 1) * voltDbRenderer.maxVisibleRows;

                }

                // pageStartIndex need not be initialized if isNext is undefined(when page loads intially or during reload operation)
                if (currentAction == VoltDbUI.ACTION_STATES.PREVIOUS) {
                    pageStartIndex = (voltDbRenderer.procedureTableIndex - 1) * voltDbRenderer.maxVisibleRows;
                }
                if ((currentAction == VoltDbUI.ACTION_STATES.REFRESH && priorAction == VoltDbUI.ACTION_STATES.NEXT) ||
                    (currentAction == VoltDbUI.ACTION_STATES.REFRESH && priorAction == VoltDbUI.ACTION_STATES.PREVIOUS)) {
                    pageStartIndex = (voltDbRenderer.procedureTableIndex) * voltDbRenderer.maxVisibleRows;

                }

                isNextButtonClicked = voltDbRenderer.isNextClicked;
                if (isNextButtonClicked == false) {
                    if (currentAction == VoltDbUI.ACTION_STATES.SEARCH || currentAction == VoltDbUI.ACTION_STATES.NONE) {
                        pageStartIndex = 0;
                        voltDbRenderer.procedureTableIndex = 0;
                    }
                }

                var lProcedureData = voltDbRenderer.isProcedureSearch ? this.searchData.procedures : procedureData;
                jQuery.each(lProcedureData, function (id, val) {
                    if (currentAction == VoltDbUI.ACTION_STATES.NEXT && (voltDbRenderer.isProcedureSearch == false || voltDbRenderer.isProcedureSearch == undefined)) {
                        if (counter >= pageStartIndex && counter <= (voltDbRenderer.procedureTableIndex + 2) * voltDbRenderer.maxVisibleRows - 1) {
                            setProcedureTupleHtml(val);
                            if (counter == (voltDbRenderer.procedureTableIndex + 2) * voltDbRenderer.maxVisibleRows - 1 || counter == voltDbRenderer.procedureDataSize - 1) {
                                voltDbRenderer.procedureTableIndex++;
                                return false;

                            }

                        } else if (counter == pageStartIndex * 2) {
                            voltDbRenderer.procedureTableIndex++;
                            return false;

                        }

                    } else if (currentAction == VoltDbUI.ACTION_STATES.PREVIOUS && (voltDbRenderer.isProcedureSearch == false || voltDbRenderer.isProcedureSearch == undefined)) {
                        if (pageStartIndex >= 0 && counter >= pageStartIndex && counter < (voltDbRenderer.procedureTableIndex * voltDbRenderer.maxVisibleRows)) {
                            setProcedureTupleHtml(val);
                        }
                        if (pageStartIndex >= 0 && counter == (voltDbRenderer.procedureTableIndex * voltDbRenderer.maxVisibleRows - 1)) {
                            voltDbRenderer.procedureTableIndex--;
                        }
                    } else if (currentAction == VoltDbUI.ACTION_STATES.PREVIOUS && priorAction == VoltDbUI.ACTION_STATES.PREVIOUS) {
                        if (counter >= 0 && counter >= pageStartIndex && counter < voltDbRenderer.procedureTableIndex * voltDbRenderer.maxVisibleRows) {
                            setProcedureTupleHtml(val);
                        }

                        if (pageStartIndex >= 0 && counter == (voltDbRenderer.procedureTableIndex * voltDbRenderer.maxVisibleRows - 1)) {
                            voltDbRenderer.procedureTableIndex--;
                        }
                    } else if (currentAction == VoltDbUI.ACTION_STATES.PREVIOUS && priorAction == VoltDbUI.ACTION_STATES.NEXT) {
                        if (counter >= 0 && counter >= pageStartIndex && counter < voltDbRenderer.procedureTableIndex * voltDbRenderer.maxVisibleRows) {
                            setProcedureTupleHtml(val);
                        }

                        if (pageStartIndex >= 0 && counter == (voltDbRenderer.procedureTableIndex * voltDbRenderer.maxVisibleRows - 1)) {
                            voltDbRenderer.procedureTableIndex--;
                        }
                    } else if (currentAction == VoltDbUI.ACTION_STATES.REFRESH && priorAction == VoltDbUI.ACTION_STATES.NEXT) {
                        if (counter >= pageStartIndex && counter <= (voltDbRenderer.procedureTableIndex + 1) * voltDbRenderer.maxVisibleRows - 1) {
                            setProcedureTupleHtml(val);
                        }
                    } else if ((currentAction == VoltDbUI.ACTION_STATES.REFRESH && priorAction == VoltDbUI.ACTION_STATES.PREVIOUS)) {
                        if (pageStartIndex >= 0 && counter >= pageStartIndex && counter < ((voltDbRenderer.procedureTableIndex + 1) * voltDbRenderer.maxVisibleRows)) {
                            setProcedureTupleHtml(val);

                        }
                    } else if ((currentAction == VoltDbUI.ACTION_STATES.SEARCH && priorAction == VoltDbUI.ACTION_STATES.NONE)) {
                        if (pageStartIndex >= 0 && counter >= pageStartIndex && counter < ((voltDbRenderer.procedureTableIndex + 1) * voltDbRenderer.maxVisibleRows)) {
                            setProcedureTupleHtml(val);
                        }
                    } else if ((currentAction == VoltDbUI.ACTION_STATES.NEXT && priorAction == VoltDbUI.ACTION_STATES.SEARCH) || (currentAction == VoltDbUI.ACTION_STATES.NEXT && priorAction == VoltDbUI.ACTION_STATES.NEXT)) {
                        if (counter >= pageStartIndex && counter <= (voltDbRenderer.procedureTableIndex + 2) * voltDbRenderer.maxVisibleRows - 1) {
                            setProcedureTupleHtml(val);
                        }

                        if ((counter == (voltDbRenderer.procedureTableIndex + 2) * voltDbRenderer.maxVisibleRows - 1 || counter == voltDbRenderer.procedureSearchDataSize - 1) && htmlMarkup != "") {
                            voltDbRenderer.procedureTableIndex++;
                            return false;
                        }
                    } else if ((currentAction == VoltDbUI.ACTION_STATES.NEXT && priorAction == VoltDbUI.ACTION_STATES.PREVIOUS)) {
                        if (counter >= pageStartIndex && counter <= (voltDbRenderer.procedureTableIndex + 2) * voltDbRenderer.maxVisibleRows - 1) {
                            setProcedureTupleHtml(val);
                        }

                        if ((counter == (voltDbRenderer.procedureTableIndex + 1) * voltDbRenderer.maxVisibleRows - 1 || counter == voltDbRenderer.procedureSearchDataSize - 1) && htmlMarkup != "") {
                            voltDbRenderer.procedureTableIndex++;
                            return false;

                        }
                    } else {
                        if (counter < voltDbRenderer.maxVisibleRows) {
                            setProcedureTupleHtml(val);
                        }
                    }
                    counter++;
                });


                if (voltDbRenderer.isProcedureSearch) {
                    if (htmlMarkup != "") {
                        if ((currentAction == VoltDbUI.ACTION_STATES.SEARCH || currentAction == VoltDbUI.ACTION_STATES.REFRESH) && (priorAction == VoltDbUI.ACTION_STATES.SEARCH || priorAction == VoltDbUI.ACTION_STATES.REFRESH)) {
                            $('#storeProcedureBody').html(htmlMarkup);

                        }
                        callback(currentAction, htmlMarkup);
                    }
                    priorAction = currentAction;

                } else {
                    htmlMarkups.SystemInformation.push(htmlMarkup);
                    htmlMarkup = undefined;

                    if (htmlMarkups.SystemInformation[0] != "")
                        callback(currentAction, htmlMarkups);
                }

            }

            if (voltDbRenderer.isSortProcedures && VoltDbUI.sortStatus == VoltDbUI.SORT_STATES.SORTED) {
                VoltDbUI.sortStatus = VoltDbUI.SORT_STATES.NONE;
            }
        };

        this.mapProcedureInformationSorting = function (currentAction, priorAction, callback) {
            var counter = 0;
            var pageStartIndex = 0;
            var traverse = false;

            htmlMarkup = "";
            htmlMarkups.SystemInformation = [];

            var iterateProcedureData = function () {
                counter = 0;
                var lProcedureData = voltDbRenderer.isProcedureSearch ? voltDbRenderer.searchData.procedures : procedureData;
                jQuery.each(lProcedureData, function (id, val) {
                    if (currentAction == VoltDbUI.ACTION_STATES.NEXT && (voltDbRenderer.isProcedureSearch == false || voltDbRenderer.isProcedureSearch == undefined)) {
                        if (counter >= pageStartIndex && counter <= (voltDbRenderer.procedureTableIndex + 2) * voltDbRenderer.maxVisibleRows - 1) {
                            setProcedureTupleHtml(val);
                            if (counter == (voltDbRenderer.procedureTableIndex + 2) * voltDbRenderer.maxVisibleRows - 1 || counter == voltDbRenderer.procedureDataSize - 1) {
                                voltDbRenderer.procedureTableIndex++;
                                return false;

                            }

                        } else if (counter == pageStartIndex * 2) {
                            voltDbRenderer.procedureTableIndex++;
                            return false;

                        }

                    } else if (currentAction == VoltDbUI.ACTION_STATES.PREVIOUS && (voltDbRenderer.isProcedureSearch == false || voltDbRenderer.isProcedureSearch == undefined)) {
                        if (pageStartIndex >= 0 && counter >= pageStartIndex && counter < (voltDbRenderer.procedureTableIndex * voltDbRenderer.maxVisibleRows)) {
                            setProcedureTupleHtml(val);
                        }
                        if (pageStartIndex >= 0 && counter == (voltDbRenderer.procedureTableIndex * voltDbRenderer.maxVisibleRows - 1)) {
                            voltDbRenderer.procedureTableIndex--;
                        }
                    } else if (currentAction == VoltDbUI.ACTION_STATES.PREVIOUS && priorAction == VoltDbUI.ACTION_STATES.PREVIOUS) {
                        if (counter >= 0 && counter >= pageStartIndex && counter < voltDbRenderer.procedureTableIndex * voltDbRenderer.maxVisibleRows) {
                            setProcedureTupleHtml(val);
                        }

                        if (pageStartIndex >= 0 && counter == (voltDbRenderer.procedureTableIndex * voltDbRenderer.maxVisibleRows - 1)) {
                            voltDbRenderer.procedureTableIndex--;
                        }
                    } else if (currentAction == VoltDbUI.ACTION_STATES.PREVIOUS && priorAction == VoltDbUI.ACTION_STATES.NEXT) {
                        if (counter >= 0 && counter >= pageStartIndex && counter < voltDbRenderer.procedureTableIndex * voltDbRenderer.maxVisibleRows) {
                            setProcedureTupleHtml(val);
                        }

                        if (pageStartIndex >= 0 && counter == (voltDbRenderer.procedureTableIndex * voltDbRenderer.maxVisibleRows - 1)) {
                            voltDbRenderer.procedureTableIndex--;
                        }
                    } else if (currentAction == VoltDbUI.ACTION_STATES.REFRESH && priorAction == VoltDbUI.ACTION_STATES.NEXT) {
                        if (counter >= pageStartIndex && counter <= (voltDbRenderer.procedureTableIndex + 1) * voltDbRenderer.maxVisibleRows - 1) {
                            setProcedureTupleHtml(val);
                        }
                    } else if ((currentAction == VoltDbUI.ACTION_STATES.REFRESH && priorAction == VoltDbUI.ACTION_STATES.PREVIOUS)) {
                        if (pageStartIndex >= 0 && counter >= pageStartIndex && counter < ((voltDbRenderer.procedureTableIndex + 1) * voltDbRenderer.maxVisibleRows)) {
                            setProcedureTupleHtml(val);

                        }
                    } else if ((currentAction == VoltDbUI.ACTION_STATES.SEARCH && priorAction == VoltDbUI.ACTION_STATES.NONE)) {
                        if (pageStartIndex >= 0 && counter >= pageStartIndex && counter < ((voltDbRenderer.procedureTableIndex + 1) * voltDbRenderer.maxVisibleRows)) {
                            setProcedureTupleHtml(val);
                        }
                    } else if ((currentAction == VoltDbUI.ACTION_STATES.NEXT && priorAction == VoltDbUI.ACTION_STATES.SEARCH) || (currentAction == VoltDbUI.ACTION_STATES.NEXT && priorAction == VoltDbUI.ACTION_STATES.NEXT)) {
                        if (counter >= pageStartIndex && counter <= (voltDbRenderer.procedureTableIndex + 2) * voltDbRenderer.maxVisibleRows - 1) {
                            setProcedureTupleHtml(val);
                        }

                        if ((counter == (voltDbRenderer.procedureTableIndex + 2) * voltDbRenderer.maxVisibleRows - 1 || counter == voltDbRenderer.procedureSearchDataSize - 1) && htmlMarkup != "") {
                            voltDbRenderer.procedureTableIndex++;
                            return false;
                        }
                    } else if ((currentAction == VoltDbUI.ACTION_STATES.NEXT && priorAction == VoltDbUI.ACTION_STATES.PREVIOUS)) {
                        if (counter >= pageStartIndex && counter <= (voltDbRenderer.procedureTableIndex + 2) * voltDbRenderer.maxVisibleRows - 1) {
                            setProcedureTupleHtml(val);
                        }

                        if ((counter == (voltDbRenderer.procedureTableIndex + 1) * voltDbRenderer.maxVisibleRows - 1 || counter == voltDbRenderer.procedureSearchDataSize - 1) && htmlMarkup != "") {
                            voltDbRenderer.procedureTableIndex++;
                            return false;

                        }
                    } else {
                        if (counter < voltDbRenderer.maxVisibleRows) {
                            setProcedureTupleHtml(val);
                        }
                    }
                    counter++;
                });
            };

            if (procedureData == null || procedureData == undefined) {
                alert("Error: Unable to extract Procedure Data");
                return;
            }

            //if checks if tuple count is greater than 5
            //other no needs for pagination action validation
            if ((((voltDbRenderer.procedureTableIndex + 1) * this.maxVisibleRows < voltDbRenderer.procedureDataSize) && currentAction == VoltDbUI.ACTION_STATES.NEXT) ||
                (currentAction == VoltDbUI.ACTION_STATES.PREVIOUS && voltDbRenderer.procedureTableIndex > 0) ||
                (currentAction == VoltDbUI.ACTION_STATES.SEARCH && !voltDbRenderer.isProcedureSortClicked) ||
                (priorAction == VoltDbUI.ACTION_STATES.SEARCH && currentAction == VoltDbUI.ACTION_STATES.SORT) ||
                currentAction == VoltDbUI.ACTION_STATES.REFRESH ||
                currentAction == VoltDbUI.ACTION_STATES.SORT ||
                currentAction == VoltDbUI.ACTION_STATES.NONE) {

                if (currentAction == VoltDbUI.ACTION_STATES.NEXT) {
                    pageStartIndex = (voltDbRenderer.procedureTableIndex + 1) * voltDbRenderer.maxVisibleRows;

                }

                if (currentAction == VoltDbUI.ACTION_STATES.PREVIOUS) { // pageStartIndex need not be initialized if isNext is undefined(when page loads intially or during reload operation)
                    pageStartIndex = (voltDbRenderer.procedureTableIndex - 1) * voltDbRenderer.maxVisibleRows;
                }

                if ((currentAction == VoltDbUI.ACTION_STATES.REFRESH && priorAction == VoltDbUI.ACTION_STATES.NEXT) ||
                    (currentAction == VoltDbUI.ACTION_STATES.REFRESH && priorAction == VoltDbUI.ACTION_STATES.PREVIOUS)) {
                    pageStartIndex = (voltDbRenderer.procedureTableIndex) * voltDbRenderer.maxVisibleRows;

                }

                if (currentAction == VoltDbUI.ACTION_STATES.SEARCH || currentAction == VoltDbUI.ACTION_STATES.NONE ||
                    (currentAction == VoltDbUI.ACTION_STATES.REFRESH && voltDbRenderer.isSortProcedures == true) ||
                    (currentAction == VoltDbUI.ACTION_STATES.SORT)) {
                    pageStartIndex = 0;
                    voltDbRenderer.procedureTableIndex = 0;
                }
                iterateProcedureData();


            } else {
                //if previous is infinitely and sorting is clicked
                if (currentAction == VoltDbUI.ACTION_STATES.PREVIOUS || voltDbRenderer.isProcedureSortClicked) {
                    pageStartIndex = 0;
                    voltDbRenderer.procedureTableIndex = 0;

                    var lProcedureData = voltDbRenderer.isProcedureSearch ? this.searchData.procedures : procedureData;
                    jQuery.each(lProcedureData, function (id, val) {
                        if (counter >= pageStartIndex && counter <= voltDbRenderer.maxVisibleRows - 1) {
                            setProcedureTupleHtml(val);
                            counter++;
                        }
                    });
                    priorAction = currentAction;

                }

            }

            if (voltDbRenderer.isSortProcedures && VoltDbUI.sortStatus == VoltDbUI.SORT_STATES.SORTED) {
                VoltDbUI.sortStatus = VoltDbUI.SORT_STATES.NONE;
            }

            if (voltDbRenderer.getLatencyGraphInformationcurrentProcedureAction == VoltDbUI.ACTION_STATES.SEARCH) {
                voltDbRenderer.priorProcedureAction = voltDbRenderer.currentProcedureAction;
            }

            voltDbRenderer.currentProcedureAction = VoltDbUI.ACTION_STATES.REFRESH;
            VoltDbUI.CurrentProcedureDataProgress = VoltDbUI.DASHBOARD_PROGRESS_STATES.REFRESH_PROCEDUREDATA_NONE;

            callback(htmlMarkup);

        };

        this.mapTableInformation = function (currentAction, priorAction, isSearch, callback) {
            var counter = 0;
            var tablePageStartIndex = 0;

            if (tableData == null || tableData == undefined) {
                alert("Error: Unable to extract Table Data");
                return;
            }

            htmlTableMarkup = "";
            htmlTableMarkups.SystemInformation = [];

            if ((((voltDbRenderer.tableIndex + 1) * this.maxVisibleRows < voltDbRenderer.tableDataSize) && currentAction == VoltDbUI.ACTION_STATES.NEXT) ||
                (currentAction == VoltDbUI.ACTION_STATES.PREVIOUS && voltDbRenderer.tableIndex > 0) ||
                currentAction == VoltDbUI.ACTION_STATES.REFRESH ||
                currentAction == VoltDbUI.ACTION_STATES.SEARCH ||
                currentAction == VoltDbUI.ACTION_STATES.NONE ||
                voltDbRenderer.isTableSortClicked) {
                if (currentAction == VoltDbUI.ACTION_STATES.NEXT) {
                    tablePageStartIndex = (voltDbRenderer.tableIndex + 1) * voltDbRenderer.maxVisibleRows;

                }

                else if (currentAction == VoltDbUI.ACTION_STATES.PREVIOUS) { // pageStartIndex need not be initialized if isNext is undefined(when page loads intially or during reload operation)
                    tablePageStartIndex = (voltDbRenderer.tableIndex - 1) * voltDbRenderer.maxVisibleRows;

                }

                else if (((currentAction == VoltDbUI.ACTION_STATES.REFRESH && priorAction == VoltDbUI.ACTION_STATES.NEXT) ||
                    (currentAction == VoltDbUI.ACTION_STATES.REFRESH && priorAction == VoltDbUI.ACTION_STATES.PREVIOUS)) && !voltDbRenderer.isTableSortClicked) {
                    tablePageStartIndex = (voltDbRenderer.tableIndex) * voltDbRenderer.maxVisibleRows;

                }

                else if (currentAction == VoltDbUI.ACTION_STATES.SEARCH || currentAction == VoltDbUI.ACTION_STATES.NONE || voltDbRenderer.isTableSortClicked == true) {
                    //if (!(priorAction == VoltDbUI.ACTION_STATES.PREVIOUS || priorAction == VoltDbUI.ACTION_STATES.NEXT)) {
                        tablePageStartIndex = 0;
                        voltDbRenderer.tableIndex = 0;
                        
                    //}
                    
                }

                var lTableData = this.isTableSearch ? this.searchData.tables : tableData;
                if (this.isTableSearch == false) voltDbRenderer.tableDataSize = Object.keys(tableData).length;


                $.each(lTableData, function (id, val) {
                    if (currentAction == VoltDbUI.ACTION_STATES.NEXT && (voltDbRenderer.isTableSearch == false || voltDbRenderer.isTableSearch == undefined)) {
                        if (counter >= tablePageStartIndex && counter <= (voltDbRenderer.tableIndex + 2) * voltDbRenderer.maxVisibleRows - 1) {
                            setTableTupleDataHtml(val, id);
                            if (counter == (voltDbRenderer.tableIndex + 2) * voltDbRenderer.maxVisibleRows - 1 || counter == voltDbRenderer.tableDataSize - 1) {
                                voltDbRenderer.tableIndex++;
                                return false;
                            }

                        } else if (counter == tablePageStartIndex * 2) {
                            voltDbRenderer.tableIndex++;
                            return false;
                        }

                    } else if (currentAction == VoltDbUI.ACTION_STATES.PREVIOUS && (voltDbRenderer.isTableSearch == false || voltDbRenderer.isTableSearch == undefined)) {
                        if (tablePageStartIndex >= 0 && counter >= tablePageStartIndex && counter < (voltDbRenderer.tableIndex * voltDbRenderer.maxVisibleRows)) {
                            setTableTupleDataHtml(val, id);
                        }
                        if (tablePageStartIndex >= 0 && counter == (voltDbRenderer.tableIndex * voltDbRenderer.maxVisibleRows - 1)) {
                            voltDbRenderer.tableIndex--;
                        }

                    } else if (currentAction == VoltDbUI.ACTION_STATES.PREVIOUS && priorAction == VoltDbUI.ACTION_STATES.PREVIOUS) {
                        if (counter >= 0 && counter >= tablePageStartIndex && counter < voltDbRenderer.tableIndex * voltDbRenderer.maxVisibleRows) {
                            setTableTupleDataHtml(val, id);
                        }

                        if (tablePageStartIndex >= 0 && counter == (voltDbRenderer.tableIndex * voltDbRenderer.maxVisibleRows - 1)) {
                            voltDbRenderer.tableIndex--;
                        }

                    } else if (currentAction == VoltDbUI.ACTION_STATES.PREVIOUS && priorAction == VoltDbUI.ACTION_STATES.NEXT) {
                        if (counter >= 0 && counter >= tablePageStartIndex && counter < voltDbRenderer.tableIndex * voltDbRenderer.maxVisibleRows) {
                            setTableTupleDataHtml(val, id);
                        }

                        if (tablePageStartIndex >= 0 && counter == (voltDbRenderer.tableIndex * voltDbRenderer.maxVisibleRows - 1)) {
                            voltDbRenderer.tableIndex--;
                        }

                    } else if (currentAction == VoltDbUI.ACTION_STATES.REFRESH && priorAction == VoltDbUI.ACTION_STATES.NEXT) {
                        if (counter >= tablePageStartIndex && counter <= (voltDbRenderer.tableIndex + 1) * voltDbRenderer.maxVisibleRows - 1) {
                            setTableTupleDataHtml(val, id);
                        }

                    } else if ((currentAction == VoltDbUI.ACTION_STATES.REFRESH && priorAction == VoltDbUI.ACTION_STATES.PREVIOUS)) {
                        if (tablePageStartIndex >= 0 && counter >= tablePageStartIndex && counter < ((voltDbRenderer.tableIndex + 1) * voltDbRenderer.maxVisibleRows)) {
                            setTableTupleDataHtml(val, id);

                        }

                    } else if ((currentAction == VoltDbUI.ACTION_STATES.SEARCH && priorAction == VoltDbUI.ACTION_STATES.NONE) || (currentAction == VoltDbUI.ACTION_STATES.SEARCH && priorAction == VoltDbUI.ACTION_STATES.SEARCH) ||
                    (currentAction == VoltDbUI.ACTION_STATES.SEARCH && priorAction == VoltDbUI.ACTION_STATES.REFRESH)) {
                        if (tablePageStartIndex >= 0 && counter >= tablePageStartIndex && counter < ((voltDbRenderer.tableIndex + 1) * voltDbRenderer.maxVisibleRows)) {
                            setTableTupleDataHtml(val, id);
                        }

                    } else if ((currentAction == VoltDbUI.ACTION_STATES.NEXT && priorAction == VoltDbUI.ACTION_STATES.SEARCH) || (currentAction == VoltDbUI.ACTION_STATES.NEXT && priorAction == VoltDbUI.ACTION_STATES.NEXT)) {
                        if (counter >= tablePageStartIndex && counter <= (voltDbRenderer.tableIndex + 2) * voltDbRenderer.maxVisibleRows - 1) {
                            setTableTupleDataHtml(val, id);
                        }

                        if ((counter == (voltDbRenderer.tableIndex + 2) * voltDbRenderer.maxVisibleRows - 1 || counter == voltDbRenderer.tableSearchDataSize - 1) && htmlTableMarkup != "") {
                            voltDbRenderer.tableIndex++;                           
                            return false;
                        }

                    } else if ((currentAction == VoltDbUI.ACTION_STATES.NEXT && priorAction == VoltDbUI.ACTION_STATES.PREVIOUS)) {
                        if (counter >= tablePageStartIndex && counter <= (voltDbRenderer.tableIndex + 2) * voltDbRenderer.maxVisibleRows - 1) {
                            setTableTupleDataHtml(val, id);
                        }

                        if ((counter == (voltDbRenderer.tableIndex + 1) * voltDbRenderer.maxVisibleRows - 1 || counter == voltDbRenderer.tableSearchDataSize - 1) && htmlTableMarkup != "") {
                            voltDbRenderer.tableIndex++;
                            return false;
                        }

                    } else {
                        if (counter < voltDbRenderer.maxVisibleRows) {
                            setTableTupleDataHtml(val, id);
                        }

                    }
                    counter++;

                });


                if (voltDbRenderer.isSortTables) {
                    callback(htmlTableMarkup);
                    htmlTableMarkup = "";
                }
                else {
                    htmlTableMarkups.SystemInformation.push(htmlTableMarkup);
                    htmlTableMarkup = "";
                    callback(htmlTableMarkups.SystemInformation);

                }

                if (voltDbRenderer.isSortTables && VoltDbUI.tableSortStatus == VoltDbUI.SORT_STATES.SORTED) {
                    VoltDbUI.tableSortStatus = VoltDbUI.SORT_STATES.NONE;
                }
            }

        };

        this.getVersion = function (serverName) {
            var version;
            $.each(systemOverview, function (key, val) {
                if (val["HOSTNAME"] == serverName) {
                    version = val["VERSION"];
                    return false;
                }
            });
            return version;
        };

        this.getServerIP = function (hostId) {
            var serverAddress;
            $.each(systemOverview, function (key, val) {
                if (key == hostId) {
                    serverAddress = val["IPADDRESS"];
                    return false;
                }

            });
            return serverAddress;
        };

        this.sortTablesByColumns = function (isSearched) {
            var lConnection = VoltDBService.getTablesContextForSorting();

            if (voltDbRenderer.isTableSearch) {
                voltDbRenderer.formatSearchTablesDataToJsonArray(lConnection, $('#filterDatabaseTable')[0].value, isSearched);

                if (voltDbRenderer.sortTableOrder == "descending") {
                    tableSearchJsonArray = descendingSortJSON(tableSearchJsonArray, this.tableSortColumn);
                }

                else if (voltDbRenderer.sortTableOrder == "ascending") {
                    tableSearchJsonArray = ascendingSortJSON(tableSearchJsonArray, this.tableSortColumn);
                }
                mapJsonArrayToSearchedTables();
            }

            else if (!voltDbRenderer.isTableSearch) {
                populateTableJsonArray(lConnection);

                if (voltDbRenderer.sortTableOrder == "descending") {
                    tableJsonArray = descendingSortJSON(tableJsonArray, this.tableSortColumn);
                }

                else if (voltDbRenderer.sortTableOrder == "ascending") {
                    tableJsonArray = ascendingSortJSON(tableJsonArray, this.tableSortColumn);
                }
                mapJsonArrayToTables();

            }

        };

        this.sortProceduresByColumns = function (isSearched) {
            var isSorted = false;
            if (!voltDbRenderer.isProcedureSearch) {
                var lConnection = VoltDBService.getProcedureContextForSorting();
                if (lConnection != null) {
                    populateProcedureJsonArrayForSorting(lConnection);

                    if (voltDbRenderer.sortOrder == "descending") {
                        procedureJsonArray = descendingSortJSON(procedureJsonArray, this.sortColumn);
                    }

                    else if (voltDbRenderer.sortOrder == "ascending") {
                        procedureJsonArray = ascendingSortJSON(procedureJsonArray, this.sortColumn);
                    }
                    mapJsonArrayToProcedures();
                    isSorted = true;

                } else {
                    isSorted = false;
                }

            }
            else if (voltDbRenderer.isProcedureSearch) {
                voltDbRenderer.formatSearchDataToJsonArray(isSearched);

                if (voltDbRenderer.sortOrder == "descending") {
                    procedureSearchJsonArray = descendingSortJSON(procedureSearchJsonArray, this.sortColumn);
                }

                else if (voltDbRenderer.sortOrder == "ascending") {
                    procedureSearchJsonArray = ascendingSortJSON(procedureSearchJsonArray, this.sortColumn);
                }
                mapJsonArrayToSearchedProcedures();
                isSorted = true;
            }
            return isSorted;
        };

        var getLatencyDetails = function (connection, latency) {

            var colIndex = {};
            var counter = 0;

            connection.Metadata['@Statistics_LATENCY_HISTOGRAM'].schema.forEach(function (columnInfo) {
                if (columnInfo["name"] == "HOSTNAME" || columnInfo["name"] == "UNCOMPRESSED_HISTOGRAM" || columnInfo["name"] == "TIMESTAMP")
                    colIndex[columnInfo["name"]] = counter;

                counter++;
            });

            connection.Metadata['@Statistics_LATENCY_HISTOGRAM'].data.forEach(function (info) {
                var hostName = info[colIndex["HOSTNAME"]];
                if (!latency.hasOwnProperty(hostName)) {
                    latency[hostName] = {};
                }
                latency[hostName]["TIMESTAMP"] = info[colIndex["TIMESTAMP"]];
                latency[hostName]["UNCOMPRESSED_HISTOGRAM"] = info[colIndex["UNCOMPRESSED_HISTOGRAM"]];
            });
        };

        var getMemoryDetails = function (connection, sysMemory, processName) {
            var counter = 0;
            var hostNameIndex = 0;
            var tupledDataIndex = 0;
            var tupleCountIndex = 0;
            var rssIndex = 0;
            var totalMemoryIndex = -1;
            var suffix = "";
            var timeStampIndex = 0;
            var idIndex = 0;
            var hostNameList = {};

            if (processName == "GRAPH_MEMORY") {
                suffix = "_" + processName;
                hostNameList = { "1": { "HOSTNAME": getCurrentServer() } };
            } else {
                hostNameList = systemOverview;
            }

            getCurrentServer();

            connection.Metadata['@Statistics_MEMORY' + suffix].schema.forEach(function (columnInfo) {

                if (columnInfo["name"] == "HOSTNAME")
                    hostNameIndex = counter;
                else if (columnInfo["name"] == "TUPLEDATA")
                    tupledDataIndex = counter;
                else if (columnInfo["name"] == "TUPLECOUNT")
                    tupleCountIndex = counter;
                else if (columnInfo["name"] == "RSS")
                    rssIndex = counter;
                else if (columnInfo["name"] == "TOTALMEMORY")
                    totalMemoryIndex = counter;
                else if (columnInfo["name"] == "TIMESTAMP")
                    timeStampIndex = counter;
                else if (columnInfo["name"] == "HOST_ID")
                    idIndex = counter;
                counter++;
            });

            connection.Metadata['@Statistics_MEMORY' + suffix].data.forEach(function (memoryInfo) {
                jQuery.each(hostNameList, function (id, val) {
                    if (val["HOSTNAME"] == memoryInfo[hostNameIndex]) {

                        var hostName = memoryInfo[hostNameIndex];

                        if (!sysMemory.hasOwnProperty(hostName)) {
                            sysMemory[hostName] = {};
                        }

                        sysMemory[hostName]["TIMESTAMP"] = memoryInfo[timeStampIndex];
                        sysMemory[hostName]["HOSTNAME"] = hostName;
                        sysMemory[hostName]["TUPLEDATA"] = memoryInfo[tupledDataIndex];
                        sysMemory[hostName]["TUPLECOUNT"] = memoryInfo[tupleCountIndex];
                        sysMemory[hostName]["RSS"] = memoryInfo[rssIndex];
                        sysMemory[hostName]["HOST_ID"] = memoryInfo[idIndex];

                        //If the value of TotalMemory is passed, then totalMemoryIndex will be greater than -1.
                        //TODO: Remove the condition "totalMemoryIndex > -1" and just set it to "memoryInfo[totalMemoryIndex]" after it has been implemented in the API.
                        sysMemory[hostName]["TOTALMEMORY"] = totalMemoryIndex > -1 ? memoryInfo[totalMemoryIndex] : -1;

                        //TODO: Use TotalMemory after it has been implemented in the API.
                        //sysMemory[hostName]["MEMORYUSAGE"] = (sysMemory[hostName]["RSS"] / sysMemory[hostName]["TOTALMEMORY"]) * 100;
                        var memoryUsage = (sysMemory[hostName]["TUPLEDATA"] / sysMemory[hostName]["RSS"]) * 100;
                        sysMemory[hostName]["MEMORYUSAGE"] = Math.round(memoryUsage * 100) / 100;
                    }

                });
            });
        };

        var getCpuDetails = function (connection, sysMemory) {
            var colIndex = {};
            var counter = 0;

            connection.Metadata['@Statistics_CPU'].schema.forEach(function (columnInfo) {
                if (columnInfo["name"] == "HOSTNAME" || columnInfo["name"] == "PERCENT_USED" || columnInfo["name"] == "TIMESTAMP")
                    colIndex[columnInfo["name"]] = counter;
                counter++;
            });

            connection.Metadata['@Statistics_CPU'].data.forEach(function (info) {
                var hostName = info[colIndex["HOSTNAME"]];
                if (!sysMemory.hasOwnProperty(hostName)) {
                    sysMemory[hostName] = {};
                }
                sysMemory[hostName]["TIMESTAMP"] = info[colIndex["TIMESTAMP"]];
                sysMemory[hostName]["PERCENT_USED"] = info[colIndex["PERCENT_USED"]];
            });
        };

        var getTransactionDetails = function (connection, sysTransaction) {
            var colIndex = {};
            var counter = 0;
            var currentTimerTick = 0;
            var procStats = {};

            //connection.Metadata['@Statistics_PROCEDUREPROFILE_GRAPH_TRANSACTION'] = GetTestProcedureData(connection);
            connection.Metadata['@Statistics_PROCEDUREPROFILE_GRAPH_TRANSACTION'].schema.forEach(function (columnInfo) {
                colIndex[columnInfo["name"]] = counter;
                counter++;
            });

            var dataCount = 0;
            connection.Metadata['@Statistics_PROCEDUREPROFILE_GRAPH_TRANSACTION'].data.forEach(function (table) {
                var srcData = table;
                var data = null;
                currentTimerTick = srcData[colIndex["TIMESTAMP"]];
                if (srcData[colIndex["PROCEDURE"]] in procStats) {
                    data = procStats[srcData[colIndex["PROCEDURE"]]];
                    data[1] = srcData[colIndex["INVOCATIONS"]];
                    data[2] = srcData[colIndex["WEIGHTED_PERC"]];
                    data[3] = srcData[colIndex["MIN"]];
                    data[4] = srcData[colIndex["AVG"]];
                    data[5] = srcData[colIndex["MAX"]];
                } else {
                    data = [srcData[colIndex["PROCEDURE"]], srcData[colIndex["INVOCATIONS"]], srcData[colIndex["WEIGHTED_PERC"]], srcData[colIndex["MIN"]], srcData[colIndex["AVG"]], srcData[colIndex["MAX"]]];
                }
                procStats[srcData[colIndex["PROCEDURE"]]] = data;
                if (dataCount == connection.Metadata['@Statistics_PROCEDUREPROFILE_GRAPH_TRANSACTION'].data.length - 1) {
                    sysTransaction["TimeStamp"] = srcData[colIndex["TIMESTAMP"]];
                }
                dataCount++;
            });
            var currentTimedTransactionCount = 0.0;
            for (var proc in procStats) {
                currentTimedTransactionCount += procStats[proc][1];
            }
            sysTransaction["CurrentTimedTransactionCount"] = currentTimedTransactionCount;
            sysTransaction["currentTimerTick"] = currentTimerTick;

        };

        function getTableData(connection, tablesData, viewsData, proceduresData, procedureColumnsData, sysProceduresData, processName) {
            var suffix = "";
            if (processName == "TABLE_INFORMATION") {
                suffix = "_" + processName;
            }

            var rawTables = connection.Metadata['@Statistics_TABLE' + suffix].data;
            var rawIndexes = connection.Metadata['@Statistics_INDEX' + suffix].data;
            var rawColumns = connection.Metadata['@SystemCatalog_COLUMNS' + suffix].data;
            var procedures = connection.Metadata['@SystemCatalog_PROCEDURES' + suffix].data;
            var procedureColumns = connection.Metadata['@SystemCatalog_PROCEDURECOLUMNS' + suffix].data;

            var tables = [];
            var exports = [];
            var views = [];

            for (var k = 0; k < rawTables.length; k++) {
                var tableName = rawTables[k][5];
                if (rawTables[k][6] == 'StreamedTable')
                    exports[tableName] = { name: tableName };
                else {
                    var isView = false;
                    var item = { name: tableName, key: null, indexes: null, columns: null };
                    for (var j = 0; j < rawIndexes.length; j++) {
                        if (rawIndexes[j][6].toUpperCase() == tableName.toUpperCase()) {
                            var indexName = rawIndexes[j][5];
                            if (item.indexes == null)
                                item.indexes = [];
                            item.indexes[indexName] = indexName + ' (' + ((rawIndexes[j][7].toLowerCase().indexOf('hash') > -1) ? 'Hash' : 'Tree') + (rawIndexes[j][8] == "1" ? ', Unique' : '') + ')';
                            if (indexName.toUpperCase().indexOf("MATVIEW") > -1)
                                isView = true;
                            if (indexName.toUpperCase().indexOf("PK_") > -1)
                                item.key = indexName;
                        }
                    }
                    if (isView)
                        views[tableName] = item;
                    else
                        tables[tableName] = item;
                }
            }

            connection.Metadata['tables'] = tables;
            connection.Metadata['views'] = views;

            for (var i = 0; i < rawColumns.length; i++) {
                var TableName = rawColumns[i][2].toUpperCase();
                if (connection.Metadata['tables'][TableName] != null) {
                    if (connection.Metadata['tables'][TableName].columns == null) {
                        connection.Metadata['tables'][TableName].columns = [];
                    }
                    connection.Metadata['tables'][TableName].columns[rawColumns[i][16]] =
                        rawColumns[i][3].toUpperCase() +
                        ' (' + rawColumns[i][5].toLowerCase() + ')';
                }
                else if (connection.Metadata['views'][TableName] != null) {
                    if (connection.Metadata['views'][TableName].columns == null) {
                        connection.Metadata['views'][TableName].columns = [];
                    }
                    connection.Metadata['views'][TableName].columns[rawColumns[i][3].toUpperCase()] =
                        rawColumns[i][3].toUpperCase() +
                        ' (' + rawColumns[i][5].toLowerCase() + ')';
                }
            }

            // User Procedures
            for (var i = 0; i < procedures.length; ++i) {
                var connTypeParams = [];
                var procParams = [];
                var procName = procedures[i][2];
                for (var p = 0; p < procedureColumns.length; ++p) {
                    if (procedureColumns[p][2] == procName) {
                        paramType = procedureColumns[p][6];
                        paramName = procedureColumns[p][3];
                        paramOrder = procedureColumns[p][17] - 1;
                        procParams[paramOrder] = { 'name': paramName, 'type': paramType.toLowerCase() };
                    }
                }

                for (var p = 0; p < procParams.length; ++p) {
                    connTypeParams[connTypeParams.length] = procParams[p].type;
                }

                //// make the procedure callable.
                connection.procedures[procName] = {};
                connection.procedures[procName]['' + connTypeParams.length] = connTypeParams;
            }

            if (!tablesData.hasOwnProperty('tables')) {
                tablesData['tables'] = {};
            }
            if (!viewsData.hasOwnProperty('views')) {
                viewsData['views'] = {};
            }
            if (!proceduresData.hasOwnProperty('procedures')) {
                proceduresData['procedures'] = {};
            }
            if (!procedureColumnsData.hasOwnProperty('procedureColumns')) {
                procedureColumnsData['procedureColumns'] = {};
            }
            if (!sysProceduresData.hasOwnProperty('sysProcedures')) {
                sysProceduresData['sysProcedures'] = {};
            }

            tablesData['tables'] = connection.Metadata['tables'];
            viewsData['views'] = connection.Metadata['views'];
            proceduresData['procedures'] = procedures;
            procedureColumnsData['procedureColumns'] = procedureColumns;
            sysProceduresData['sysProcedures'] = connection.Metadata['sysprocs'];
        }


        //common methods
        var formatTableNoData = function (listName) {
            if (listName == "PROCEDURE") {
                lblPrevious.innerHTML = " ".concat(0, ' ');
                lblTotalPages.innerHTML = " ".concat(0);
                $('#storeProcedureBody').html("<tr><td colspan=6>No data to be displayed</td></tr>");

            } else if (listName == "TABLE") {
                lblPreviousTable.innerHTML = " ".concat(0, ' ');
                lblTotalPagesofTables.innerHTML = " ".concat(0);
                $('#tablesBody').html("<tr><td colspan=6>No data to be displayed</td></tr>");
            }

        };

        var formatTableData = function (connection) {
            var i = 0;
            var tableMetadata = [];
            var totalTupleCount = 0;
            var partitionEntryCount = 0;
            var newPartition = false;
            var tupleCountPartitions = [];
            var partitionData = {};

            if (voltDbRenderer.refreshTables) {
                if (connection.Metadata["@Statistics_TABLE"] != undefined || connection.Metadata["@Statistics_TABLE"] != null) {
                    if (connection.Metadata["@Statistics_TABLE"].data != "" &&
                        connection.Metadata["@Statistics_TABLE"].data != [] &&
                        connection.Metadata["@Statistics_TABLE"].data != undefined) {

                        tableMetadata = connection.Metadata["@Statistics_TABLE"].data;
                        tableData = {};

                        $.each(tableMetadata, function (key, tupleData) {
                            if (tupleData != undefined) {
                                partitionEntryCount = 0;

                                if (!partitionData.hasOwnProperty(tupleData[tableNameIndex])) {
                                    partitionData[tupleData[tableNameIndex]] = [];
                                    partitionData[tupleData[tableNameIndex]].push(tupleData);

                                } else {
                                    $.each(partitionData[tupleData[tableNameIndex]], function (nestKey, nestData) {
                                        for (i = 0; i < partitionData[tupleData[tableNameIndex]].length; i++) {
                                            partitionEntryCount++;
                                            //if partition is repeated for a given table in "partitionData"
                                            if (tupleData[partitionIndex] == partitionData[tupleData[tableNameIndex]][i][partitionIndex]) {
                                                newPartition = false;
                                                schemaCatalogTableTypes[tupleData[tableNameIndex]]["TABLE_TYPE"] = schemaCatalogTableTypes[tupleData[tableNameIndex]].TABLE_TYPE == "VIEW" ? "VIEW" : "REPLICATED";
                                                return false;
                                            }

                                        }
                                        if (partitionEntryCount == partitionData[tupleData[tableNameIndex]].length) {
                                            newPartition = true;
                                            partitionData[tupleData[tableNameIndex]].push(tupleData);
                                            return true;

                                        }
                                    });
                                }
                            }
                        });

                        //formulate max, min, average for each table
                        $.each(partitionData, function (key, data) {
                            if (!tableData.hasOwnProperty(key)) {
                                tableData[key] = {};
                            }

                            for (i = 0; i < data.length; i++) {
                                totalTupleCount += parseInt(data[i][tupleCountIndex]);
                                tupleCountPartitions[i] = data[i][tupleCountIndex];
                            }

                            tableData[key] = {
                                "TABLE_NAME": key,
                                "MAX_ROWS": Math.max.apply(null, tupleCountPartitions),
                                "MIN_ROWS": Math.min.apply(null, tupleCountPartitions),
                                "AVG_ROWS": getAverage(tupleCountPartitions),
                                "TUPLE_COUNT": totalTupleCount,
                                "TABLE_TYPE": getColumnTypes(key) == "PARTITION_COLUMN" ? "PARTITIONED" : schemaCatalogTableTypes[key].TABLE_TYPE
                            };

                        });
                    }
                    else {
                        formatTableNoData("TABLE");

                    }

                }
            }

        };

        var mapJsonArrayToProcedures = function () {
            var i = 0;
            var procedureName;
            procedureData = [];
            var procedure = {};

            if (procedureJsonArray != undefined) {
                for (i = 0; i < procedureJsonArray.length; i++) {
                    procedureName = procedureJsonArray[i].PROCEDURE;
                    if (!procedureData.hasOwnProperty(procedureName)) {
                        procedure = {
                            'PROCEDURE': procedureJsonArray[i].PROCEDURE,
                            'INVOCATIONS': procedureJsonArray[i].INVOCATIONS,
                            'MIN_LATENCY': procedureJsonArray[i].MIN_LATENCY,
                            'MAX_LATENCY': procedureJsonArray[i].MAX_LATENCY,
                            'AVG_LATENCY': procedureJsonArray[i].AVG_LATENCY,
                            'PERC_EXECUTION': procedureJsonArray[i].PERC_EXECUTION
                        };
                        procedureData.push(procedure);
                    }
                }
            }

        };

        var mapJsonArrayToSearchedProcedures = function () {
            var i = 0;
            var procedureName;
            lSearchData['procedures'] = [];
            var searchTuple = {};

            if (procedureSearchJsonArray != undefined) {
                for (i = 0; i < procedureSearchJsonArray.length; i++) {
                    procedureName = procedureSearchJsonArray[i].PROCEDURE;
                    if (!lSearchData.hasOwnProperty(procedureName)) {
                        searchTuple = {};
                        searchTuple['PROCEDURE'] = procedureSearchJsonArray[i].PROCEDURE;
                        searchTuple['INVOCATIONS'] = procedureSearchJsonArray[i].INVOCATIONS;
                        searchTuple['MIN_LATENCY'] = procedureSearchJsonArray[i].MIN_LATENCY;
                        searchTuple['MAX_LATENCY'] = procedureSearchJsonArray[i].MAX_LATENCY;
                        searchTuple['AVG_LATENCY'] = procedureSearchJsonArray[i].AVG_LATENCY;
                        searchTuple['PERC_EXECUTION'] = procedureSearchJsonArray[i].PERC_EXECUTION;

                        lSearchData['procedures'].push(searchTuple);

                    }
                }
            }
        };

        var setProcedureTupleHtml = function (val) {
            if (!$.isEmptyObject(val)) {
                if (htmlMarkup == "") {
                    htmlMarkup = "<tr><td>" + val['PROCEDURE'] + "</td>" +
                        "<td class=\"txt-center\">" + val['INVOCATIONS'] + "</td>" +
                        "<td class=\"txt-center\">" + val['MIN_LATENCY'] + "</td>" +
                        "<td class=\"txt-center\">" + val['MAX_LATENCY'] + "</td>" +
                        "<td class=\"txt-center\">" + val['AVG_LATENCY'] + "</td>" +
                        "<td class=\"txt-center\">" + val['PERC_EXECUTION'] + "</td></tr>";

                } else {

                    htmlMarkup += "<tr><td>" + val['PROCEDURE'] + "</td>" +
                        "<td class=\"txt-center\">" + val['INVOCATIONS'] + "</td>" +
                        "<td class=\"txt-center\">" + val['MIN_LATENCY'] + "</td>" +
                        "<td class=\"txt-center\">" + val['MAX_LATENCY'] + "</td>" +
                        "<td class=\"txt-center\">" + val['AVG_LATENCY'] + "</td>" +
                        "<td class=\"txt-center\">" + val['PERC_EXECUTION'] + "</td></tr>";
                }
            }
        };

        var mapJsonArrayToTables = function () {
            var i = 0;
            var tableName = "";
            tableData = {};
            if (tableJsonArray != undefined) {
                for (i = 0; i < tableJsonArray.length; i++) {
                    if (i > 0) {
                        if (tableJsonArray[i].TABLE_NAME != tableJsonArray[i - 1].TABLE_NAME) {
                            tableName = tableJsonArray[i].TABLE_NAME;
                        }
                    }
                    if (!tableData.hasOwnProperty(tableName)) {
                        tableName = tableJsonArray[i].TABLE_NAME;
                        tableData[tableName] = {};
                    }

                    tableData[tableName] = {
                        "TABLE_NAME": tableName,
                        "MAX_ROWS": tableJsonArray[i].MAX_ROWS,
                        "MIN_ROWS": tableJsonArray[i].MIN_ROWS,
                        "AVG_ROWS": tableJsonArray[i].AVG_ROWS,
                        "TUPLE_COUNT": tableJsonArray[i].TUPLE_COUNT,
                        "TABLE_TYPE": tableJsonArray[i].TABLE_TYPE,

                    };
                }
            }

        };

        var mapJsonArrayToSearchedTables = function () {
            var i = 0;
            var counter = 0;
            var tableName = "";
            lSearchData.tables = {};

            if (tableSearchJsonArray != undefined) {
                for (i = 0; i < tableSearchJsonArray.length; i++) {
                    if (i > 0) {
                        if (tableSearchJsonArray[i].TABLE_NAME != tableSearchJsonArray[i - 1].TABLE_NAME) {
                            tableName = tableSearchJsonArray[i].TABLE_NAME;
                        }
                    }
                    if (!lSearchData.tables.hasOwnProperty(tableName)) {
                        tableName = tableSearchJsonArray[i].TABLE_NAME;
                        lSearchData.tables[tableName] = {};
                        counter = 0;
                    }

                    lSearchData.tables[tableName] = {
                        "TABLE_NAME": tableName,
                        "MAX_ROWS": tableSearchJsonArray[i].MAX_ROWS,
                        "MIN_ROWS": tableSearchJsonArray[i].MIN_ROWS,
                        "AVG_ROWS": tableSearchJsonArray[i].AVG_ROWS,
                        "TUPLE_COUNT": tableSearchJsonArray[i].TUPLE_COUNT,
                        "TABLE_TYPE": tableSearchJsonArray[i].TABLE_TYPE,
                    };
                    counter++;

                }
            }
        };

        var setTableTupleDataHtml = function (tuple, tableName) {
            if (htmlTableMarkup == undefined || htmlTableMarkup == "") {
                htmlTableMarkup = "<tr><td>" + tableName + "</td>" +
                         "<td class=\"txt-center\">" + tuple['TUPLE_COUNT'] + "</td>" +
                         "<td class=\"txt-center\">" + tuple['MAX_ROWS'] + "</td>" +
                         "<td class=\"txt-center\">" + tuple['MIN_ROWS'] + "</td>" +
                         "<td class=\"txt-center\">" + tuple['AVG_ROWS'] + "</td>" +
                         "<td class=\"txt-center\">" + tuple['TABLE_TYPE'] + "</td></tr>";
            } else {
                htmlTableMarkup += "<tr><td>" + tableName + "</td>" +
                        "<td class=\"txt-center\">" + tuple['TUPLE_COUNT'] + "</td>" +
                        "<td class=\"txt-center\">" + tuple['MAX_ROWS'] + "</td>" +
                        "<td class=\"txt-center\">" + tuple['MIN_ROWS'] + "</td>" +
                       "<td class=\"txt-center\">" + tuple['AVG_ROWS'] + "</td>" +
                       "<td class=\"txt-center\">" + tuple['TABLE_TYPE'] + "</td></tr>";
            }
        };

        var getAverage = function (arrayData) {
            var i;
            var dataSum = 0;
            var average;
            if (arrayData != null) {
                for (i = 0; i < arrayData.length; i++) {
                    dataSum += parseInt(arrayData[i]);
                }
                average = Math.round(dataSum / arrayData.length, 2);
                return average;

            }
            return 0;
        };

        var ascendingSortJSON = function (data, key) {
            return data.sort(function (a, b) {
                var x = a[key]; var y = b[key];
                return ((x < y) ? -1 : ((x > y) ? 1 : 0));
            });
        };

        var descendingSortJSON = function (data, key) {
            return data.sort(function (a, b) {
                var x = a[key]; var y = b[key];
                return ((x > y) ? -1 : ((x < y) ? 1 : 0));
            });
        };

        var checkIfDuplicateJson = function (jsonArray, keyValue) {
            var i = 0;
            var isDuplicate = false;
            for (i = 0; i < jsonArray.length; i++) {
                if (jsonArray[i].PROCEDURE == keyValue) {
                    isDuplicate = true;
                    break;

                }
            }
            return isDuplicate;
        };

        var checkSortColumnSortable = function () {
            var isSearchable = 0;
            if (voltDbRenderer.isSortProcedures) {
                if (voltDbRenderer.sortColumn == "TABLE_NAME")
                    isSearchable = true;

                else
                    isSearchable = false;

            }
            else if (voltDbRenderer.isSortTables) {
                if (voltDbRenderer.tableSortColumn == "TABLE_NAME")
                    isSearchable = true;

                else
                    isSearchable = false;
            }

            return isSearchable;
        };

        var getColumnTypes = function (tableName) {
            var columnType = "";
            $.each(schemaCatalogColumnTypes, function (key, typeVal) {
                if (tableName == typeVal['TABLE_NAME']) {
                    columnType = typeVal['REMARKS'];
                    return false;
                }
            });

            if (columnType == "PARTITION_COLUMN") {
                return columnType;
            } else {
                return columnType;
            }


        };

        //Search methods
        var lSearchData = this.searchData;
        this.searchProcedures = function (searchType, searchKey, onProcedureSearched) {
            var searchDataCount = 0;

            if (procedureData == null || procedureData == undefined) {
                return;
            }

            lSearchData['procedures'] = [];
            $.each(procedureData, function (nestKey, tupleData) {
                if (tupleData != undefined) {
                    if (tupleData.PROCEDURE.toLowerCase().indexOf(searchKey.toLowerCase()) >= 0) {
                        lSearchData['procedures'][searchDataCount] = tupleData;
                        searchDataCount++;

                    }

                }
            });

            this.procedureSearchDataSize = searchDataCount;
            onProcedureSearched(searchDataCount > 0);

        };

        this.searchTables = function (connection, searchKey, onTablesSearched) {
            var searchDataCount = 0;

            if (tableData == null || tableData == undefined) {
                return;
            }
            lSearchData.tables = {};

            $.each(tableData, function (nestKey, tupleData) {
                if (tupleData != undefined) {
                    if (nestKey.toLowerCase().indexOf(searchKey.toLowerCase()) >= 0) {
                        lSearchData.tables[nestKey] = tupleData;
                        searchDataCount++;

                    }
                }
            });

            if (searchDataCount == 0)
                lSearchData.tables = {};

            this.tableSearchDataSize = searchDataCount;
            onTablesSearched(searchDataCount > 0);
        };

        this.formatSearchDataToJsonArray = function (isSearched) {
            var searchProcedureCount = 0;
            procedureSearchJsonArray = [];

            function iterateSearchProcedureData() {
                $.each(lSearchData.procedures, function (key, data) {
                    minLatency = data.MIN_LATENCY * Math.pow(10, -6);
                    maxLatency = data.MAX_LATENCY * Math.pow(10, -6);
                    avgLatency = data.AVG_LATENCY * Math.pow(10, -6);

                    minLatency = parseFloat(minLatency.toFixed(2));
                    maxLatency = parseFloat(maxLatency.toFixed(2));
                    avgLatency = parseFloat(avgLatency.toFixed(2));

                    procedureSearchJsonArray[searchProcedureCount] = {
                        "PROCEDURE": data.PROCEDURE,
                        "INVOCATIONS": data.INVOCATIONS,
                        "MIN_LATENCY": data.MIN_LATENCY,
                        "MAX_LATENCY": data.MAX_LATENCY,
                        "AVG_LATENCY": data.AVG_LATENCY,
                        "PERC_EXECUTION": data.PERC_EXECUTION
                    };

                    searchProcedureCount++;
                });
            }

            if (isSearched) {
                if (lSearchData.procedures != "" || lSearchData.procedures != undefined) {
                    iterateSearchProcedureData();
                }

            } else {
                voltDbRenderer.searchProcedures(connection, $('#filterStoredProc')[0].value, function (searchResult) {
                    iterateSearchProcedureData();
                });
            }
        };

        this.formatSearchTablesDataToJsonArray = function (connection, searchKey, isSearched) {
            var searchTableCount = 0;
            tableSearchJsonArray = [];

            function iterateSearchTableData() {
                $.each(lSearchData.tables, function (nestKey, tupleData) {
                    if (tupleData != undefined) {
                        if (nestKey.toLowerCase().indexOf(searchKey.toLowerCase()) >= 0) {
                            tableSearchJsonArray[searchTableCount] = {
                                "TABLE_NAME": nestKey,
                                "MAX_ROWS": tupleData["MAX_ROWS"],
                                "MIN_ROWS": tupleData["MIN_ROWS"],
                                "AVG_ROWS": tupleData["AVG_ROWS"],
                                "TUPLE_COUNT": tupleData["TUPLE_COUNT"],
                                "TABLE_TYPE": getColumnTypes(nestKey) == "PARTITION_COLUMN" ? "PARTITIONED" : schemaCatalogTableTypes[nestKey].TABLE_TYPE
                            };
                            searchTableCount++;

                        }
                    }

                });
            }

            if (isSearched) {
                if (lSearchData.tables != "" || lSearchData.tables != undefined) {
                    iterateSearchTableData();
                }

            } else {
                voltDbRenderer.searchTables(connection, $('#filterDatabaseTable')[0].value, function (searchResult) {
                    if (searchResult) {
                        iterateSearchTableData();
                    }

                });
            }

        };

    });
    window.voltDbRenderer = voltDbRenderer = new iVoltDbRenderer();

})(window);


//Navigation responsive	
$(function () {
    $('#toggleMenu').click(function () {
        $("#nav").slideToggle('slow');
        $("#nav").css('left', '0');
        $("#nav ul li").click(function () {
            $("#nav").css('display', 'none');
            $(window).resize();
        });
    });
});

$(window).resize(function () {
    //alert("resized");
    var windowWidth = $(window).width();
    if (windowWidth > 699) {
        //alert(windowWidth);
        $("#nav").css('display', 'block');

    } else if (windowWidth < 699) {
        $("#nav").css('display', 'none');
    }

});
