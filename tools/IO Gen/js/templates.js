// ── templates.js ──────────────────────────────────────────────────────────────
// Plantillas XML estáticas para la generación de archivos .xml y .tmc.
// Se exponen como objeto global APP_TEMPLATES y se mezclan en data() de Vue
// para que los generadores puedan acceder a ellas via this.tpl*.
// ─────────────────────────────────────────────────────────────────────────────

const APP_TEMPLATES = {

  // Cabecera del fichero Alarms.tmc (hasta el primer <EventId>)
  tplTmcHeader:
    `<?xml version="1.0"?>\n` +
    `<TcModuleClass>\n` +
    `\t<DataTypes>\n` +
    `\t\t<DataType>\n` +
    `\t\t\t<Name GUID="{F35E4D12-5B8B-4C8F-95D2-0AE92108A152}">AlarmClass</Name>\n` +
    `\t\t\t<DisplayName TxtId=""><![CDATA[Alarms]]></DisplayName>`,

  // Pie del fichero Alarms.tmc (después del último <EventId>)
  tplTmcFooter:
    `\t\t\t<Hides>\n` +
    `\t\t\t\t<Hide GUID="{E7B8BF09-DA2F-43D9-8251-4C214D77CFBB}"/>\n` +
    `\t\t\t\t<Hide GUID="{CBF90603-C429-49C1-92C4-454EBD10F716}"/>\n` +
    `\t\t\t\t<Hide GUID="{42EEBECA-5185-42BE-8389-5A7DA26A926F}"/>\n` +
    `\t\t\t\t<Hide GUID="{21017743-398E-4446-8129-0925ADC15AD9}"/>\n` +
    `\t\t\t\t<Hide GUID="{390EA75C-CC63-4FC5-9B03-1A06C29A2A30}"/>\n` +
    `\t\t\t\t<Hide GUID="{551E4D89-E3A8-4642-B7A6-77482930F8C8}"/>\n` +
    `\t\t\t\t<Hide GUID="{CA4CA1EF-B7E4-43CB-8D79-D140B03E196E}"/>\n` +
    `\t\t\t\t<Hide GUID="{BD7EAD56-F85A-434F-BC76-EA84C4194656}"/>\n` +
    `\t\t\t\t<Hide GUID="{5BE57882-1887-4DC6-A745-62AE0883584B}"/>\n` +
    `\t\t\t\t<Hide GUID="{8BBF7EC2-E5D4-44E6-B5BF-C7CDA821DCCC}"/>\n` +
    `\t\t\t\t<Hide GUID="{B6CAB811-BEF3-4E23-B0B4-9381B807F4C7}"/>\n` +
    `\t\t\t\t<Hide GUID="{43FFCBA6-5F44-43ED-9771-FB96E54B41CD}"/>\n` +
    `\t\t\t\t<Hide GUID="{AF1B25DF-6DE6-4A41-8105-FABBE55412B5}"/>\n` +
    `\t\t\t\t<Hide GUID="{DC81660B-BCFD-45D8-932F-18A29A2DB34C}"/>\n` +
    `\t\t\t\t<Hide GUID="{B2B6336A-1BAA-4CC3-960F-F398DB7EAD14}"/>\n` +
    `\t\t\t\t<Hide GUID="{AC3C0553-739E-43F7-B723-0B5692D67F4F}"/>\n` +
    `\t\t\t\t<Hide GUID="{3A5B0D97-C9A0-4EFE-90D0-92D148DF41AD}"/>\n` +
    `\t\t\t\t<Hide GUID="{4A6C504E-0A05-4046-BF0B-BCBC5903E5D3}"/>\n` +
    `\t\t\t\t<Hide GUID="{0E8410E7-FFF7-4B2F-8DFE-3C501CCD38E6}"/>\n` +
    `\t\t\t\t<Hide GUID="{A23DB3C7-DA7F-48C6-B9B8-188165D24202}"/>\n` +
    `\t\t\t\t<Hide GUID="{1C918F25-D9E1-47DC-99F5-41179C9E0E7A}"/>\n` +
    `\t\t\t\t<Hide GUID="{4E02245A-FA0B-4E1A-8E68-C5DAD38BD585}"/>\n` +
    `\t\t\t\t<Hide GUID="{92789ACA-75D3-4964-B159-1F23A113C540}"/>\n` +
    `\t\t\t\t<Hide GUID="{F324088C-1E2B-436A-ABBB-168FC6F6D393}"/>\n` +
    `\t\t\t\t<Hide GUID="{F77806D3-4A13-4580-80D7-8D9C364E1BD1}"/>\n` +
    `\t\t\t</Hides>\n` +
    `\t\t</DataType>\n` +
    `\t</DataTypes>\n` +
    `</TcModuleClass>`,

  // Plantilla XML para generar IO_Tags.xml y GVL.xml
  // El marcador "// Insert code here" se sustituye por el texto PLC generado.
  tplXmlIOTags: `<?xml version="1.0" encoding="utf-8"?>
	  <project xmlns="http://www.plcopen.org/xml/tc6_0200">
	  <fileHeader companyName="Beckhoff Automation GmbH" productName="TwinCAT PLC Control" productVersion="3.5.20.60" creationDateTime="2026-02-19T13:40:53.8672332" />
	  <contentHeader name="Untitled1" modificationDateTime="2026-02-19T13:40:53.8717493">
		<coordinateInfo>
		  <fbd>
			<scaling x="1" y="1" />
		  </fbd>
		  <ld>
			<scaling x="1" y="1" />
		  </ld>
		  <sfc>
			<scaling x="1" y="1" />
		  </sfc>
		</coordinateInfo>
		<addData>
		  <data name="http://www.3s-software.com/plcopenxml/projectinformation" handleUnknown="implementation">
			<ProjectInformation />
		  </data>
		</addData>
	  </contentHeader>
	  <types>
		<dataTypes />
		<pous />
	  </types>
	  <instances>
		<configurations />
	  </instances>
	  <addData>
		<data name="http://www.3s-software.com/plcopenxml/globalvars" handleUnknown="implementation">
		  <globalVars name="IO_Tags">
			<addData>
			  <data name="http://www.3s-software.com/plcopenxml/attributes" handleUnknown="implementation">
				<Attributes>
				  <Attribute Name="global_init_slot" Value="40500" />
				</Attributes>
			  </data>
			  <data name="http://www.3s-software.com/plcopenxml/buildproperties" handleUnknown="implementation">
				<BuildProperties>
				  <LinkAlways>true</LinkAlways>
				</BuildProperties>
			  </data>
			  <data name="http://www.3s-software.com/plcopenxml/interfaceasplaintext" handleUnknown="implementation">
				<InterfaceAsPlainText>
				  <xhtml xmlns="http://www.w3.org/1999/xhtml">{attribute 'global_init_slot' := '40500'}
VAR_GLOBAL
// Insert code here
END_VAR</xhtml>
				</InterfaceAsPlainText>
			  </data>
			  <data name="http://www.3s-software.com/plcopenxml/objectid" handleUnknown="discard">
				<ObjectId>b57b3cc8-481e-47d2-932e-c1d070231dc5</ObjectId>
			  </data>
			</addData>
		  </globalVars>
		</data>
		<data name="http://www.3s-software.com/plcopenxml/projectstructure" handleUnknown="discard">
		  <ProjectStructure>
			<Object Name="IO_Tags" ObjectId="b57b3cc8-481e-47d2-932e-c1d070231dc5" />
		  </ProjectStructure>
		</data>
	  </addData>
	</project>`,

  // Plantilla XML para generar Alarm_tags.xml
  // Los marcadores __MAX_ID__ / __MAX_IDA__ y "// Insert code here"
  // se sustituyen durante la generación.
  tplXmlAlarmTags: `<?xml version="1.0" encoding="utf-8"?>
		<project xmlns="http://www.plcopen.org/xml/tc6_0200">
		  <fileHeader companyName="Beckhoff Automation GmbH" productName="TwinCAT PLC Control" productVersion="3.5.20.60" creationDateTime="2026-02-19T13:41:07.4111748" />
		  <contentHeader name="Untitled1" modificationDateTime="2026-02-19T13:41:07.4111748">
			<coordinateInfo>
			  <fbd>
				<scaling x="1" y="1" />
			  </fbd>
			  <ld>
				<scaling x="1" y="1" />
			  </ld>
			  <sfc>
				<scaling x="1" y="1" />
			  </sfc>
			</coordinateInfo>
			<addData>
			  <data name="http://www.3s-software.com/plcopenxml/projectinformation" handleUnknown="implementation">
				<ProjectInformation />
			  </data>
			</addData>
		  </contentHeader>
		  <types>
			<dataTypes />
			<pous />
		  </types>
		  <instances>
			<configurations />
		  </instances>
		  <addData>
			<data name="http://www.3s-software.com/plcopenxml/globalvars" handleUnknown="implementation">
			  <globalVars name="Alarm_tags" constant="true">
				<variable name="ArrMinD">
				  <type>
					<INT />
				  </type>
				  <initialValue>
					<simpleValue value="1" />
				  </initialValue>
				  <documentation>
					<xhtml xmlns="http://www.w3.org/1999/xhtml"> Digital alarm array size</xhtml>
				  </documentation>
				</variable>
				<variable name="ArrMaxD">
				  <type>
					<INT />
				  </type>
				  <initialValue>
					<simpleValue value="!!!'ERROR'!!!" />
				  </initialValue>
				</variable>
				<variable name="ArrMinA">
				  <type>
					<INT />
				  </type>
				  <initialValue>
					<simpleValue value="1" />
				  </initialValue>
				  <documentation>
					<xhtml xmlns="http://www.w3.org/1999/xhtml"> Analog alarm array size</xhtml>
				  </documentation>
				</variable>
				<variable name="ArrMaxA">
				  <type>
					<INT />
				  </type>
				  <initialValue>
					<simpleValue value="!!!'ERROR'!!!" />
				  </initialValue>
				</variable>
				<variable name="Arr_AlarmDigital">
				  <type>
					<array>
					  <dimension lower="ArrMinD" upper="ArrMaxD" />
					  <baseType>
						<derived name="ST_ALARM_DI" />
					  </baseType>
					</array>
				  </type>
				  <documentation>
					<xhtml xmlns="http://www.w3.org/1999/xhtml"> Array needs to be at least as big as the highest digital struct ID</xhtml>
				  </documentation>
				</variable>
				<variable name="Arr_AlarmAnalog">
				  <type>
					<array>
					  <dimension lower="ArrMinA" upper="ArrMaxA" />
					  <baseType>
						<derived name="ST_ALARM_AI" />
					  </baseType>
					</array>
				  </type>
				  <documentation>
					<xhtml xmlns="http://www.w3.org/1999/xhtml"> Array needs to be at least as big as the highest analog struct ID</xhtml>
				  </documentation>
				</variable>
				<addData>
				  <data name="http://www.3s-software.com/plcopenxml/attributes" handleUnknown="implementation">
					<Attributes>
					  <Attribute Name="global_init_slot" Value="40502" />
					</Attributes>
				  </data>
				  <data name="http://www.3s-software.com/plcopenxml/buildproperties" handleUnknown="implementation">
					<BuildProperties>
					  <LinkAlways>true</LinkAlways>
					</BuildProperties>
				  </data>
				  <data name="http://www.3s-software.com/plcopenxml/interfaceasplaintext" handleUnknown="implementation">
					<InterfaceAsPlainText>
					  <xhtml xmlns="http://www.w3.org/1999/xhtml">{attribute 'global_init_slot' := '40502'}
VAR_GLOBAL CONSTANT
	// Digital alarm array size
	ArrMinD: INT := 1;
	ArrMaxD: INT := __MAX_ID__;
	// Analog alarm array size
	ArrMinA: INT := 1;
	ArrMaxA: INT := __MAX_IDA__;
END_VAR

VAR_GLOBAL
	// Array needs to be at least as big as the highest digital struct ID
	Arr_AlarmDigital: ARRAY[ArrMinD..ArrMaxD] OF ST_ALARM_DI;
	// Array needs to be at least as big as the highest analog struct ID
	Arr_AlarmAnalog: ARRAY[ArrMinA..ArrMaxA] OF ST_ALARM_AI;
END_VAR

VAR_GLOBAL PERSISTENT
	// Insert code here
END_VAR</xhtml>
					</InterfaceAsPlainText>
				  </data>
				  <data name="http://www.3s-software.com/plcopenxml/objectid" handleUnknown="discard">
					<ObjectId>c33b50e5-b5f9-493f-a74a-119256a28240</ObjectId>
				  </data>
				  <data name="http://www.3s-software.com/plcopenxml/mixedattrsvarlist" handleUnknown="implementation">
					<MixedAttrsVarList>
					  <globalVars name="Alarm_tags" constant="true">
						<variable name="ArrMinD">
						  <type>
							<INT />
						  </type>
						  <initialValue>
							<simpleValue value="1" />
						  </initialValue>
						  <documentation>
							<xhtml xmlns="http://www.w3.org/1999/xhtml"> Digital alarm array size</xhtml>
						  </documentation>
						</variable>
						<variable name="ArrMaxD">
						  <type>
							<INT />
						  </type>
						  <initialValue>
							<simpleValue value="!!!'ERROR'!!!" />
						  </initialValue>
						</variable>
						<variable name="ArrMinA">
						  <type>
							<INT />
						  </type>
						  <initialValue>
							<simpleValue value="1" />
						  </initialValue>
						  <documentation>
							<xhtml xmlns="http://www.w3.org/1999/xhtml"> Analog alarm array size</xhtml>
						  </documentation>
						</variable>
						<variable name="ArrMaxA">
						  <type>
							<INT />
						  </type>
						  <initialValue>
							<simpleValue value="!!!'ERROR'!!!" />
						  </initialValue>
						</variable>
					  </globalVars>
					  <globalVars name="Alarm_tags">
						<variable name="Arr_AlarmDigital">
						  <type>
							<array>
							  <dimension lower="ArrMinD" upper="ArrMaxD" />
							  <baseType>
								<derived name="ST_ALARM_DI" />
							  </baseType>
							</array>
						  </type>
						  <documentation>
							<xhtml xmlns="http://www.w3.org/1999/xhtml"> Array needs to be at least as big as the highest digital struct ID</xhtml>
						  </documentation>
						</variable>
						<variable name="Arr_AlarmAnalog">
						  <type>
							<array>
							  <dimension lower="ArrMinA" upper="ArrMaxA" />
							  <baseType>
								<derived name="ST_ALARM_AI" />
							  </baseType>
							</array>
						  </type>
						  <documentation>
							<xhtml xmlns="http://www.w3.org/1999/xhtml"> Array needs to be at least as big as the highest analog struct ID</xhtml>
						  </documentation>
						</variable>
					  </globalVars>
					</MixedAttrsVarList>
				  </data>
				</addData>
			  </globalVars>
			</data>
			<data name="http://www.3s-software.com/plcopenxml/projectstructure" handleUnknown="discard">
			  <ProjectStructure>
				<Object Name="Alarm_tags" ObjectId="c33b50e5-b5f9-493f-a74a-119256a28240" />
			  </ProjectStructure>
			</data>
		  </addData>
	  </project>`,

};
